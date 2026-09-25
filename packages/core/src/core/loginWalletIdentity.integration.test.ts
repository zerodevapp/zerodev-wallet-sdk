/**
 * Boundary: Wallet Core <-> KMS on the LOGIN side (the `passkey`/`login` branch of
 * `auth()` in `createZeroDevWalletCore`).
 *
 * A person holding two passkeys owns two wallets — one passkey, one wallet, working
 * as designed. So this is not a duplication defect; the question is what follows
 * from it: when a login lands on one of them, does Core resolve, scope and sign
 * under exactly that one?
 */
import { type Hex, hashMessage, recoverMessageAddress } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ApiKeyStamper, PasskeyStamper } from '../stampers/types.js'
import type { StorageAdapter } from '../storage/manager.js'
import { SessionType } from '../types/session.js'
import { createZeroDevWalletCore } from './createZeroDevWalletCore.js'

/**
 * Two independent identities, one wallet each, in two sub-orgs — which is all the
 * backend holds. Nothing links them server-side; the fact that one person holds
 * both credentials exists only on their device.
 */
const WALLETS = [
  {
    subOrgId: 'suborg-1',
    userId: 'user-suborg-1',
    signer: privateKeyToAccount(`0x${'11'.repeat(32)}` as Hex),
  },
  {
    subOrgId: 'suborg-2',
    userId: 'user-suborg-2',
    signer: privateKeyToAccount(`0x${'22'.repeat(32)}` as Hex),
  },
] as const

/** A stamp that names its key. Real stampers encode the public key into the
 *  header and the backend resolves the user from it; the encoding here is fake
 *  because this file owns both ends. */
const stampWith = (key: string) => ({
  stampHeaderName: 'X-Stamp',
  stampHeaderValue: `key:${key}`,
})

const keyOf = (value: string | null | undefined) =>
  value?.startsWith('key:') ? value.slice('key:'.length) : null

/** Tracks pending vs active like a real key store, with `indexedDbStamper`'s
 *  guards: clear drops both keys, reset drops pending, pending paths refuse to
 *  run without one. No-op versions hide sequencing bugs. */
function statefulStamper(): ApiKeyStamper {
  let activeKey: string | null = null
  let pending: string | null = null
  let n = 0
  const requirePending = () => {
    if (!pending) throw new Error('No pending key rotation')
    return pending
  }
  return {
    // No active-key guard: the real stamper has none at this layer. An
    // unregistered key is refused by the KMS, where it fails in production too.
    stamp: async () => stampWith(activeKey ?? 'unregistered'),
    clear: async () => {
      pending = null
      activeKey = null
    },
    getPublicKey: async () => activeKey,
    resetKeyPair: async () => {
      pending = null
      activeKey = `02${String(++n).padStart(64, '0')}`
    },
    prepareKeyRotation: async () => {
      pending = `02${String(++n).padStart(64, '0')}`
      return pending
    },
    stampPending: async () => stampWith(requirePending()),
    signPending: async () => {
      requirePending()
      return 'sig'
    },
    commitKeyRotation: async () => {
      activeKey = requirePending()
      pending = null
    },
    discardKeyRotation: async () => {
      pending = null
    },
    sign: async () => 'sig',
  }
}

/** Which passkey is tapped, the only thing deciding which wallet a login lands
 *  on. Its stamp names the credential, so the choice travels in the request. */
function authenticator() {
  let current: (typeof WALLETS)[number] = WALLETS[0]
  return {
    pick: (index: 0 | 1) => {
      current = WALLETS[index]
    },
    stamper: (): PasskeyStamper => ({
      stamp: async () => stampWith(credentialOf(current)),
      clear: async () => {},
      register: async () => ({
        attestation: {
          attestationObject: 'ao',
          clientDataJson: 'cdj',
          credentialId: 'credential-unused',
        },
        encodedChallenge: 'challenge',
      }),
    }),
  }
}

const credentialOf = (wallet: (typeof WALLETS)[number]) =>
  `passkey-${wallet.subOrgId}`

/** Routes that must carry the session token. Logout stamps but sends no bearer. */
const SESSION_ROUTES = ['wallets', 'authenticators', 'sign/message']

function sessionToken(publicKey: string, wallet: (typeof WALLETS)[number]) {
  return `hdr.${btoa(
    JSON.stringify({
      exp: Date.now() + 3_600_000,
      public_key: publicKey,
      session_type: SessionType.READ_WRITE,
      user_id: wallet.userId,
      organization_id: wallet.subOrgId,
    }),
  )}.sig`
}

/**
 * A KMS double answering as one identity at a time; it never returns both
 * wallets or links them, as the real endpoints cannot.
 *
 * Identity comes from the stamped credential, per `getUserWallet` and
 * `getAuthenticators`. Login binds its session key to the wallet whose passkey
 * signed it; later requests resolve by the key their stamp names. The bearer is
 * recorded, not trusted, so tests can assert Core forwarded the right one.
 */
function stubKms(auth: ReturnType<typeof authenticator>) {
  const requests: {
    path: string
    body: unknown
    bearer: string | null
    key: string | null
  }[] = []
  const sessionKeys = new Map<string, (typeof WALLETS)[number]>()
  const issued = new Map<(typeof WALLETS)[number], string>()
  let lastSessionKey = ''

  const bearerOf = (headers: HeadersInit | undefined) =>
    new Headers(headers).get('Authorization')?.replace('Bearer ', '') ?? null

  const walletFor = (key: string | null) =>
    key === null
      ? undefined
      : (WALLETS.find((w) => credentialOf(w) === key) ?? sessionKeys.get(key))

  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const target = String(url)
      const body = init?.body ? JSON.parse(String(init.body)) : {}
      const bearer = bearerOf(init?.headers)
      // Login stamps in the body, every other route in a header. No fallback
      // between them: no real endpoint accepts one in place of the other.
      const bodyKey = keyOf(body?.stamp?.stampHeaderValue)
      const headerKey = keyOf(new Headers(init?.headers).get('X-Stamp'))
      const json = (payload: unknown, status = 200) =>
        new Response(JSON.stringify(payload), {
          status,
          headers: { 'content-type': 'application/json' },
        })

      if (target.includes('server-info/parent-org-id')) {
        return json({ parentOrgId: 'parent-org' })
      }

      if (target.includes('/auth/login/stamp')) {
        requests.push({ path: 'login', body, bearer, key: bodyKey })
        const wallet = walletFor(bodyKey)
        if (!wallet) return json({ error: 'unauthenticated' }, 401)
        // The session key is bound to the wallet whose passkey signed this
        // login, and logout has to find it in the authenticator list before it
        // will erase anything locally.
        sessionKeys.set(body.targetPublicKey, wallet)
        lastSessionKey = body.targetPublicKey
        const session = sessionToken(body.targetPublicKey, wallet)
        issued.set(wallet, session)
        return json({ session })
      }

      if (target.includes('/authenticators')) {
        requests.push({ path: 'authenticators', body, bearer, key: headerKey })
        const wallet = walletFor(headerKey)
        if (!wallet) return json({ error: 'unauthenticated' }, 401)
        // Scoped to the authenticated sub-org, as the endpoint is: this lists
        // the credentials of the wallet the login landed on and cannot mention
        // the other one.
        return json({
          oauths: null,
          passkeys: [
            { rpId: 'localhost', credentialId: `cred-${wallet.subOrgId}` },
          ],
          emailContacts: null,
          apiKeys: null,
          sessionKeys: [
            { ApiKey: lastSessionKey, TurnkeyId: `apikey-${wallet.subOrgId}` },
          ],
        })
      }

      if (target.includes('/auth/logout')) {
        requests.push({ path: 'logout', body, bearer, key: headerKey })
        return json({})
      }

      if (target.includes('/wallets')) {
        requests.push({ path: 'wallets', body, bearer, key: headerKey })
        const wallet = walletFor(headerKey)
        if (!wallet) return json({ error: 'unauthenticated' }, 401)
        return json({
          walletAddresses: [wallet.signer.address],
          userId: wallet.userId,
        })
      }

      if (target.includes('/sign/message')) {
        requests.push({ path: 'sign/message', body, bearer, key: headerKey })
        // SYNTHETIC: signs with the stamped credential's wallet, ignoring
        // `signWith`. A real backend would more likely 403. This is the worse
        // answer and the one Core must handle: a valid signature, wrong wallet.
        const wallet = walletFor(headerKey)
        if (!wallet) return json({ error: 'unauthenticated' }, 401)
        const signature = await wallet.signer.sign({
          hash: `0x${body.turnkeyPayload.parameters.payload}` as Hex,
        })
        return json({ signature })
      }

      requests.push({
        path: `unstubbed:${target}`,
        body,
        bearer,
        key: headerKey,
      })
      return json({}, 404)
    }),
  )

  return {
    requests,
    /** Which passkey the authenticator offers next, standing in for the user
     *  tapping one rather than the other. Nothing Core sends influences it. */
    picks: auth.pick,
    lastOf: (path: string) => requests.filter((r) => r.path === path).at(-1),
    /** The session token the KMS issued for `index`, to assert Core forwards it. */
    tokenFor: (index: 0 | 1) => issued.get(WALLETS[index]) ?? null,
    /** Every request that should carry a session, in order, with what it sent.
     *  Nulls are kept and nothing is de-duplicated: a missing Authorization has
     *  to fail rather than vanish, and one correct request must not cover for a
     *  wrong one. Nothing here is routed by the bearer, so this observes which
     *  token Core forwarded. It says nothing about whether KMS would accept it. */
    sessionRequests: () =>
      requests
        .filter((r) => SESSION_ROUTES.includes(r.path))
        .map((r) => ({ path: r.path, bearer: r.bearer })),
  }
}

async function buildCore(auth: ReturnType<typeof authenticator>) {
  const store = new Map<string, string>()
  const adapter: StorageAdapter = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value)
    },
    removeItem: (key) => {
      store.delete(key)
    },
  }
  return createZeroDevWalletCore({
    projectId: 'proj',
    rpId: 'localhost',
    sessionStorage: adapter,
    apiKeyStamper: statefulStamper(),
    passkeyStamper: auth.stamper(),
    proxyBaseUrl: 'https://kms.test.invalid/api/v1',
  })
}

/** One authenticator shared by the KMS double and Core, so `picks()` changes
 *  which credential Core stamps with. The stamper reads the pick at stamp time,
 *  so `picks()` works before or after this call. */
async function setup() {
  const auth = authenticator()
  const kms = stubKms(auth)
  return { kms, core: await buildCore(auth) }
}

const loginWithPasskey = { type: 'passkey', mode: 'login' } as const

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('what a login is able to ask for', () => {
  it('sends only targetPublicKey, timestamp and stamp', async () => {
    const { kms, core } = await setup()

    await core.auth(loginWithPasskey)

    const login = kms.lastOf('login')
    expect(Object.keys(login?.body as object).sort()).toEqual([
      'stamp',
      'targetPublicKey',
      'timestamp',
    ])
  })
})

describe('the wallet a login lands on', () => {
  it('resolves the address of the wallet whose credential was used', async () => {
    const { kms, core } = await setup()
    kms.picks(0)

    await core.auth(loginWithPasskey)
    const account = await core.toAccount()

    expect(account.address).toBe(WALLETS[0].signer.address)
    const signature = await account.signMessage({ message: 'hello' })

    expect(signature).toMatch(/^0x[0-9a-f]{130}$/i)
    // `account.address` alone only proves Core resolved the right address; this
    // proves the wallet it resolved is the one that can actually sign for it.
    await expect(
      recoverMessageAddress({ message: 'hello', signature }),
    ).resolves.toBe(WALLETS[0].signer.address)

    // The stub answers by the stamped credential, so the right wallet coming
    // back only means the right key signed. Every bearer-bearing request has to
    // be checked too, or a stale or absent token passes unnoticed.
    expect(kms.tokenFor(0)).not.toBeNull()
    expect(kms.sessionRequests()).toEqual([
      { path: 'wallets', bearer: kms.tokenFor(0) },
      { path: 'sign/message', bearer: kms.tokenFor(0) },
    ])
  })

  it('signs under the sub-organization of the session, not the parent org it authenticated against', async () => {
    const { kms, core } = await setup()
    kms.picks(1)

    await core.auth(loginWithPasskey)
    const account = await core.toAccount()
    await account.signMessage({ message: 'hello' })

    const sign = kms.lastOf('sign/message') as {
      body: { turnkeyPayload: { organizationId: string } }
    }
    expect(sign.body.turnkeyPayload.organizationId).toBe(WALLETS[1].subOrgId)
    expect(sign.body.turnkeyPayload.organizationId).not.toBe('parent-org')

    // The sub-org above rides in the body, so it would still be right if Core
    // had forwarded no session at all.
    expect(kms.tokenFor(1)).not.toBeNull()
    expect(kms.sessionRequests()).toEqual([
      { path: 'wallets', bearer: kms.tokenFor(1) },
      { path: 'sign/message', bearer: kms.tokenFor(1) },
    ])
  })

  it('lands on a different wallet across a logout and a fresh login, with no error either time', async () => {
    const { kms, core } = await setup()

    kms.picks(0)
    await core.auth(loginWithPasskey)
    const first = await core.toAccount()
    const firstSession = await core.getSession()

    // Asserted because `logout()` returns false WITHOUT clearing when it cannot
    // confirm remote revocation — which would silently change the scenario.
    await expect(core.logout()).resolves.toBe(true)

    kms.picks(1)
    await core.auth(loginWithPasskey)
    const second = await core.toAccount()
    const secondSession = await core.getSession()

    expect(first.address).toBe(WALLETS[0].signer.address)
    expect(second.address).toBe(WALLETS[1].signer.address)
    expect(second.address).not.toBe(first.address)
    expect(firstSession?.organizationId).toBe(WALLETS[0].subOrgId)
    expect(secondSession?.organizationId).toBe(WALLETS[1].subOrgId)

    // Both sessions are local state; only the per-request bearers show which
    // token each half of the round trip actually presented.
    expect(kms.tokenFor(0)).not.toBeNull()
    expect(kms.sessionRequests()).toEqual([
      { path: 'wallets', bearer: kms.tokenFor(0) },
      { path: 'authenticators', bearer: kms.tokenFor(0) },
      { path: 'wallets', bearer: kms.tokenFor(1) },
    ])
  })

  it('replaces a live session on a bare second login, with no logout in between', async () => {
    // Login does not guard an active session (brtkx, #423). The registration
    // guard exists to stop duplicate wallets; a second login only makes a new
    // session, and refusing it would block replacing a bricked one.
    const { kms, core } = await setup()

    kms.picks(0)
    await core.auth(loginWithPasskey)
    // Asserted so the second login is provably over a LIVE session, which is the
    // only difference between this test and the logout one above.
    await expect(core.getSession()).resolves.toMatchObject({
      organizationId: WALLETS[0].subOrgId,
    })

    // No logout. A guard would throw here, so reaching the assertions is the
    // test: the second login is accepted and the first session is replaced.
    kms.picks(1)
    await core.auth(loginWithPasskey)

    const account = await core.toAccount()
    expect(account.address).toBe(WALLETS[1].signer.address)
    await expect(core.getSession()).resolves.toMatchObject({
      organizationId: WALLETS[1].subOrgId,
    })

    // Keeping the first token is the plausible bug here, and the stored session
    // says wallet 1 either way. Only the second token is expected because the
    // first login is never followed by a request: `getSession` reads locally.
    expect(kms.tokenFor(0)).not.toBeNull()
    expect(kms.sessionRequests()).toEqual([
      { path: 'wallets', bearer: kms.tokenFor(1) },
    ])
  })
})

describe('an account object that outlives the wallet it was built for', () => {
  it('refuses to sign with an account built before the switch rather than signing as the wrong wallet', async () => {
    const { kms, core } = await setup()

    kms.picks(0)
    await core.auth(loginWithPasskey)
    const staleAccount = await core.toAccount()

    await expect(core.logout()).resolves.toBe(true)
    kms.picks(1)
    await core.auth(loginWithPasskey)

    // Two redundant guards can catch this, so the match is on the shared "did
    // not recover" rather than either one's wording.
    await expect(
      staleAccount.signMessage({ message: 'hello' }),
    ).rejects.toThrow(/did not recover/)

    // The rejection comes from Core's owner check, which would fire on a stale
    // bearer too. Asserted so the test cannot pass for that reason instead.
    expect(kms.tokenFor(0)).not.toBeNull()
    expect(kms.sessionRequests()).toEqual([
      { path: 'wallets', bearer: kms.tokenFor(0) },
      { path: 'authenticators', bearer: kms.tokenFor(0) },
      { path: 'sign/message', bearer: kms.tokenFor(1) },
    ])
  })

  it('recovers the correct signer when the caller rebuilds the account after the switch', async () => {
    const { kms, core } = await setup()

    kms.picks(0)
    await core.auth(loginWithPasskey)
    await core.toAccount()

    await expect(core.logout()).resolves.toBe(true)
    kms.picks(1)
    await core.auth(loginWithPasskey)
    const rebuilt = await core.toAccount()
    const signature = await rebuilt.signMessage({ message: 'hello' })

    expect(rebuilt.address).toBe(WALLETS[1].signer.address)
    const sign = kms.lastOf('sign/message') as {
      body: { turnkeyPayload: { parameters: { payload: string } } }
    }
    expect(`0x${sign.body.turnkeyPayload.parameters.payload}`).toBe(
      hashMessage('hello'),
    )
    expect(signature).toMatch(/^0x[0-9a-f]{130}$/i)
    await expect(
      recoverMessageAddress({ message: 'hello', signature }),
    ).resolves.toBe(WALLETS[1].signer.address)

    // The switch is where a stale bearer would survive: the new credential
    // resolves the new wallet whichever token rode along with it. Asserting per
    // request is what pins it: the post-switch lookup could otherwise carry the
    // old token while only the final sign carries the new one.
    expect(kms.tokenFor(0)).not.toBeNull()
    expect(kms.sessionRequests()).toEqual([
      { path: 'wallets', bearer: kms.tokenFor(0) },
      { path: 'authenticators', bearer: kms.tokenFor(0) },
      { path: 'wallets', bearer: kms.tokenFor(1) },
      { path: 'sign/message', bearer: kms.tokenFor(1) },
    ])
  })
})
