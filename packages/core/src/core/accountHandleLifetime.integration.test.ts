/**
 * Flow: the lifetime of the account handle `toAccount` returns.
 *
 * `toAccount` splits what it captures. `organizationId` and the resolved
 * `address` are frozen when the handle is built, while `getToken` re-reads the
 *  active session on every call. Callers hold these handles for a long time so a
 *  handle outlives refreshes, logouts and user switches. `getUserWallet` ignores
 *  the `organizationId` it is passed and resolves the wallet from the bearer token
 *  instead.
 */
import { type Hex, recoverMessageAddress } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ApiKeyStamper, PasskeyStamper } from '../stampers/types.js'
import type { StorageAdapter } from '../storage/manager.js'
import { SessionType } from '../types/session.js'
import { createZeroDevWalletCore } from './createZeroDevWalletCore.js'

const WALLET_A = privateKeyToAccount(`0x${'11'.repeat(32)}` as Hex)
const WALLET_B = privateKeyToAccount(`0x${'22'.repeat(32)}` as Hex)
const ORG_A = 'org-a'
const ORG_B = 'org-b'

const sessionKey = (nth: number) => `02${String(nth).padStart(64, '0')}`

function keyStore(): ApiKeyStamper & { activeKey: () => string | null } {
  let minted = 0
  let active: string | null = null
  let pending: string | null = null
  const stamp = async () => ({
    stampHeaderName: 'X-Stamp',
    stampHeaderValue: 'stamp',
  })
  return {
    stamp,
    clear: async () => {
      active = null
      pending = null
    },
    getPublicKey: async () => active,
    resetKeyPair: async () => {
      active = sessionKey(++minted)
    },
    prepareKeyRotation: async () => {
      pending = sessionKey(++minted)
      return pending
    },
    stampPending: stamp,
    signPending: async () => 'sig',
    commitKeyRotation: async () => {
      if (pending) active = pending
      pending = null
    },
    discardKeyRotation: async () => {
      pending = null
    },
    sign: async () => 'sig',
    activeKey: () => active,
  }
}

const passkeyStamper: PasskeyStamper = {
  stamp: async () => ({
    stampHeaderName: 'X-Stamp',
    stampHeaderValue: 'stamp',
  }),
  clear: async () => {},
  register: async () => ({
    attestation: {
      attestationObject: 'ao',
      clientDataJson: 'cdj',
      credentialId: 'cred-1',
    },
    encodedChallenge: 'challenge',
  }),
}

function token(publicKey: string, org: string, nth: number) {
  return `hdr.${btoa(
    JSON.stringify({
      exp: Date.now() + 3_600_000,
      public_key: publicKey,
      session_type: SessionType.READ_WRITE,
      user_id: `user-of-${org}`,
      organization_id: org,
      jti: `t${nth}`,
    }),
  )}.sig`
}

function storage() {
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
  return { adapter, store }
}

const orgOf = (bearer: string) => {
  try {
    return JSON.parse(atob(bearer.split('.')[1])).organization_id as string
  } catch {
    return 'none'
  }
}

/** One `/sign/` request, as it went on the wire. */
type SignRequest = { signWith: string; bodyOrg: string; tokenOrg: string }

type KmsOptions = {
  /** Which organization the next stamp-login issues a session for. */
  state: { org: string }
  /** Answers the authenticator list with this vault's key, so `logout` revokes. */
  vault: { activeKey: () => string | null }
  /** Sign with the wrong wallet, to check the owner comparison still runs. */
  signWithWrongWallet?: boolean
}

/**
 * Rejects any bearer other than the one it last issued, the way KMS would once a
 * key rotated, and resolves the wallet from the token rather than from any field
 * in the request.
 */
function stubKms(options: KmsOptions) {
  let issued = 0
  let current: string | null = null
  const signed: SignRequest[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const path = String(url)
      const body = init?.body ? JSON.parse(String(init.body)) : {}
      const headers = (init?.headers ?? {}) as Record<string, string>
      const bearer = (headers.Authorization ?? '').replace('Bearer ', '')
      const json = (payload: unknown, status = 200) =>
        new Response(JSON.stringify(payload), {
          status,
          headers: { 'content-type': 'application/json' },
        })

      if (path.includes('server-info/parent-org-id')) {
        return json({ parentOrgId: 'parent-org' })
      }
      if (path.includes('/auth/login/stamp')) {
        current = token(body.targetPublicKey, options.state.org, ++issued)
        return json({ session: current })
      }
      if (path.includes('/user-wallet')) {
        const wallet = orgOf(bearer) === ORG_B ? WALLET_B : WALLET_A
        return json({ walletAddresses: [wallet.address] })
      }
      if (path.includes('authenticators')) {
        return json({
          sessionKeys: [
            { ApiKey: options.vault.activeKey() ?? '', TurnkeyId: 'tk-1' },
          ],
        })
      }
      if (path.includes('/sign/')) {
        signed.push({
          signWith: body.turnkeyPayload.parameters.signWith,
          bodyOrg: body.turnkeyPayload.organizationId,
          tokenOrg: orgOf(bearer),
        })
        if (bearer !== current) {
          return json({ error: 'token_rotated', message: 'stale token' }, 401)
        }
        const signer = options.signWithWrongWallet
          ? WALLET_B
          : body.turnkeyPayload.parameters.signWith === WALLET_B.address
            ? WALLET_B
            : WALLET_A
        return json({
          signature: await signer.sign({
            hash: `0x${body.turnkeyPayload.parameters.payload}` as Hex,
          }),
        })
      }
      if (path.includes('logout')) return json({ ok: true })
      return json({}, 404)
    }),
  )
  return { signed }
}

const build = (api: ApiKeyStamper, adapter: StorageAdapter) =>
  createZeroDevWalletCore({
    projectId: 'proj',
    rpId: 'localhost',
    sessionStorage: adapter,
    apiKeyStamper: api,
    passkeyStamper,
    proxyBaseUrl: 'https://kms.test.invalid/api/v1',
  })

const login = { type: 'passkey', mode: 'login' } as const

const caught = (p: Promise<unknown>) =>
  p.then(
    () => 'RESOLVED' as const,
    (error: unknown) => error,
  )

/** A logged-in core plus the wire log, for the common single-user setup. */
async function loggedIn(options: { signWithWrongWallet?: boolean } = {}) {
  const state = { org: ORG_A }
  const api = keyStore()
  const kms = stubKms({ state, vault: api, ...options })
  const core = await build(api, storage().adapter)
  await core.auth(login)
  return { core, kms, state, api }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('account handle: the control', () => {
  it('signs a message that recovers to the wallet it reports', async () => {
    const { core } = await loggedIn()

    const account = await core.toAccount()
    const signature = await account.signMessage({ message: 'hello' })

    expect(account.address).toBe(WALLET_A.address)
    await expect(
      recoverMessageAddress({ message: 'hello', signature }),
    ).resolves.toBe(WALLET_A.address)
  })
})

describe('account handle: it follows the live session token', () => {
  it('still signs after a refresh rotated the session', async () => {
    const { core } = await loggedIn()
    const account = await core.toAccount()
    await account.signMessage({ message: 'before' })

    await core.refreshSession()
    const signature = await account.signMessage({ message: 'after' })

    await expect(
      recoverMessageAddress({ message: 'after', signature }),
    ).resolves.toBe(WALLET_A.address)
  })

  it('still signs when it was built during a refresh', async () => {
    const { core } = await loggedIn()

    const [, account] = await Promise.all([
      core.refreshSession(),
      core.toAccount(),
    ])
    const signature = await account.signMessage({ message: 'after' })

    await expect(
      recoverMessageAddress({ message: 'after', signature }),
    ).resolves.toBe(WALLET_A.address)
  })
})

describe('account handle: it stops when the session does', () => {
  it('refuses to sign after logout without reaching KMS', async () => {
    const { core, kms } = await loggedIn()
    const account = await core.toAccount()
    await expect(core.logout()).resolves.toBe(true)

    const error = await caught(account.signMessage({ message: 'hello' }))

    expect((error as Error).message).toMatch(/no active session token/i)
    expect(kms.signed).toHaveLength(0)
  })
})

describe('account handle: identity stays frozen across a user switch', () => {
  it('keeps reporting the wallet it was built for', async () => {
    const { core, state } = await loggedIn()
    const stale = await core.toAccount()
    await expect(core.logout()).resolves.toBe(true)

    state.org = ORG_B
    await core.auth(login)
    const fresh = await core.toAccount()

    expect(stale.address).toBe(WALLET_A.address)
    expect(fresh.address).toBe(WALLET_B.address)
  })

  it('refuses a signature made by the new wallet', async () => {
    const { core, state } = await loggedIn({ signWithWrongWallet: true })
    const stale = await core.toAccount()
    await expect(core.logout()).resolves.toBe(true)
    state.org = ORG_B
    await core.auth(login)

    const error = await caught(stale.signMessage({ message: 'hello' }))

    expect(error).toBeInstanceOf(Error)
    expect(error).not.toBeInstanceOf(TypeError)
    expect((error as Error).message).toMatch(/owner|signature/i)
  })
})
