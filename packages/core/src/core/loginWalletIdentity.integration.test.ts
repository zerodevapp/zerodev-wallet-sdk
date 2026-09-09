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

/** Tracks pending vs active the way a real key store does, so the rotation
 *  sequencing in the flow under test is exercised rather than stubbed away. */
function statefulStamper(): ApiKeyStamper {
  let activeKey: string | null = null
  let pending: string | null = null
  let n = 0
  const stamp = async () => ({
    stampHeaderName: 'X-Stamp',
    stampHeaderValue: 'stamp',
  })
  return {
    stamp,
    clear: async () => {},
    getPublicKey: async () => activeKey,
    resetKeyPair: async () => {
      activeKey = `02${String(++n).padStart(64, '0')}`
    },
    prepareKeyRotation: async () => {
      pending = `02${String(++n).padStart(64, '0')}`
      return pending
    },
    stampPending: stamp,
    signPending: async () => 'sig',
    commitKeyRotation: async () => {
      if (pending) activeKey = pending
      pending = null
    },
    discardKeyRotation: async () => {
      pending = null
    },
    sign: async () => 'sig',
  }
}

/** Login only stamps; the credential it stamps with is the authenticator's pick,
 *  which is what `stubKms().picks()` stands in for. */
function passkeyStamper(): PasskeyStamper {
  return {
    stamp: async () => ({
      stampHeaderName: 'X-Stamp',
      stampHeaderValue: 'stamp',
    }),
    clear: async () => {},
    register: async () => ({
      attestation: {
        attestationObject: 'ao',
        clientDataJson: 'cdj',
        credentialId: 'credential-unused',
      },
      encodedChallenge: 'challenge',
    }),
  }
}

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
 * A KMS double that can answer as either identity, one at a time. It is NOT
 * modelling "an account with two wallets" — no such state exists server-side, so
 * there is nothing to model. It never returns both and never links them, exactly
 * as the real endpoints cannot. Which identity a login lands on is `picks()`, an
 * input it is told, because that decision is made on the device.
 *
 * Everything after login resolves the wallet from the session JWT, which is what
 * the backend does — `getUserWallet` and `getAuthenticators` both note the user is
 * resolved from the stamped credential plus the session token, with **no sub-org
 * sent in the request**. Note the direction: the sub-org is not sent, but it *is*
 * returned, as the `organization_id` claim inside the session token — which is how
 * Core learns which wallet it landed on. What never comes back is the credential
 * id, so Core knows which wallet but never which passkey produced it.
 */
function stubKms() {
  const requests: { path: string; body: unknown; subOrg: string | null }[] = []
  let picked: (typeof WALLETS)[number] = WALLETS[0]
  let lastSessionKey = ''

  const subOrgFromToken = (headers: HeadersInit | undefined) => {
    const auth = new Headers(headers).get('Authorization')
    if (!auth) return null
    const payload = auth.replace('Bearer ', '').split('.')[1]
    if (!payload) return null
    const claims = JSON.parse(atob(payload)) as { organization_id?: string }
    return claims.organization_id ?? null
  }

  const walletFor = (subOrg: string | null) =>
    WALLETS.find((w) => w.subOrgId === subOrg)

  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const target = String(url)
      const body = init?.body ? JSON.parse(String(init.body)) : {}
      const subOrg = subOrgFromToken(init?.headers)
      const json = (payload: unknown, status = 200) =>
        new Response(JSON.stringify(payload), {
          status,
          headers: { 'content-type': 'application/json' },
        })

      if (target.includes('server-info/parent-org-id')) {
        return json({ parentOrgId: 'parent-org' })
      }

      if (target.includes('/auth/login/stamp')) {
        requests.push({ path: 'login', body, subOrg })
        // The key the backend now holds for this session, which logout has to
        // find in the authenticator list before it will erase anything locally.
        lastSessionKey = body.targetPublicKey
        return json({ session: sessionToken(body.targetPublicKey, picked) })
      }

      if (target.includes('/authenticators')) {
        requests.push({ path: 'authenticators', body, subOrg })
        const wallet = walletFor(subOrg)
        if (!wallet) return json({ error: 'unauthenticated' }, 401)
        // Scoped to the authenticated sub-org, as the endpoint is: this lists
        // the credentials of the wallet the login landed on and cannot mention
        // the other one.
        return json({
          oauths: null,
          passkeys: [{ rpId: 'localhost', credentialId: `cred-${subOrg}` }],
          emailContacts: null,
          apiKeys: null,
          sessionKeys: [
            { ApiKey: lastSessionKey, TurnkeyId: `apikey-${subOrg}` },
          ],
        })
      }

      if (target.includes('/auth/logout')) {
        requests.push({ path: 'logout', body, subOrg })
        return json({})
      }

      if (target.includes('/wallets')) {
        requests.push({ path: 'wallets', body, subOrg })
        const wallet = walletFor(subOrg)
        if (!wallet) return json({ error: 'unauthenticated' }, 401)
        return json({
          walletAddresses: [wallet.signer.address],
          userId: wallet.userId,
        })
      }

      if (target.includes('/sign/message')) {
        requests.push({ path: 'sign/message', body, subOrg })
        // Signs with the wallet the SESSION belongs to, ignoring the `signWith`
        // address in the payload. That is the worst plausible KMS answer — a real
        // backend would more likely 403 a cross-sub-org `signWith` — and it is
        // the one Core has to be correct for, because it is the answer that
        // produces a valid signature from the wrong wallet.
        const wallet = walletFor(subOrg)
        if (!wallet) return json({ error: 'unauthenticated' }, 401)
        const signature = await wallet.signer.sign({
          hash: `0x${body.turnkeyPayload.parameters.payload}` as Hex,
        })
        return json({ signature })
      }

      requests.push({ path: `unstubbed:${target}`, body, subOrg })
      return json({}, 404)
    }),
  )

  return {
    requests,
    /** Which identity the authenticator offers up next — a device-side decision
     *  standing in for the user tapping one passkey rather than the other.
     *  Nothing Core sends today influences it; see the first test. */
    picks: (index: 0 | 1) => {
      picked = WALLETS[index]
    },
    lastOf: (path: string) => requests.filter((r) => r.path === path).at(-1),
  }
}

async function buildCore() {
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
    passkeyStamper: passkeyStamper(),
    proxyBaseUrl: 'https://kms.test.invalid/api/v1',
  })
}

const loginWithPasskey = { type: 'passkey', mode: 'login' } as const

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('what a login is able to ask for', () => {
  it('sends only targetPublicKey, timestamp and stamp', async () => {
    const kms = stubKms()
    const core = await buildCore()

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
    const kms = stubKms()
    kms.picks(0)
    const core = await buildCore()

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
  })

  it('signs under the sub-organization of the session, not the parent org it authenticated against', async () => {
    const kms = stubKms()
    kms.picks(1)
    const core = await buildCore()

    await core.auth(loginWithPasskey)
    const account = await core.toAccount()
    await account.signMessage({ message: 'hello' })

    const sign = kms.lastOf('sign/message') as {
      body: { turnkeyPayload: { organizationId: string } }
    }
    expect(sign.body.turnkeyPayload.organizationId).toBe(WALLETS[1].subOrgId)
    expect(sign.body.turnkeyPayload.organizationId).not.toBe('parent-org')
  })

  it('lands on a different wallet across a logout and a fresh login, with no error either time', async () => {
    const kms = stubKms()
    const core = await buildCore()

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
  })
})

describe('an account object that outlives the wallet it was built for', () => {
  it('refuses to sign with an account built before the switch rather than signing as the wrong wallet', async () => {
    const kms = stubKms()
    const core = await buildCore()

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
  })

  it('recovers the correct signer when the caller rebuilds the account after the switch', async () => {
    const kms = stubKms()
    const core = await buildCore()

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
  })
})
