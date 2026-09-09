/**
 * Flow: passkey registration, the only flow that commits two key rotations.
 *
 * The registration key is prepared, used to create the account, then promoted so
 * it can authorize a second rotation to the durable session key. The guard that
 * refuses to register while a session is active runs inside the key-transition
 * queue, so two concurrent registrations cannot each create a wallet.
 *
 * `registerMidFlowFailure` covers propagation and login recovery; this covers the
 * key sequence, the vault state each step leaves, and concurrency.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ApiKeyStamper, PasskeyStamper } from '../stampers/types.js'
import type { StorageAdapter } from '../storage/manager.js'
import { SessionType } from '../types/session.js'
import { createZeroDevWalletCore } from './createZeroDevWalletCore.js'

const sessionKey = (nth: number) => `02${String(nth).padStart(64, '0')}`

function keyStore(): ApiKeyStamper & {
  activeKey: () => string | null
  promoted: () => string[]
} {
  let minted = 0
  let active: string | null = null
  let pending: string | null = null
  const promotions: string[] = []
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
      if (pending) {
        active = pending
        promotions.push(pending)
      }
      pending = null
    },
    discardKeyRotation: async () => {
      pending = null
    },
    sign: async () => 'sig',
    activeKey: () => active,
    /** Every key that became live, in order — the two-rotation sequence. */
    promoted: () => [...promotions],
  }
}

/** Counts ceremonies, so a guard that fires too late is visible as an OS prompt. */
function passkeyStamper(): PasskeyStamper & { ceremonies: () => number } {
  let n = 0
  return {
    stamp: async () => ({
      stampHeaderName: 'X-Stamp',
      stampHeaderValue: 'stamp',
    }),
    clear: async () => {},
    register: async () => {
      n += 1
      return {
        attestation: {
          attestationObject: `ao-${n}`,
          clientDataJson: `cdj-${n}`,
          credentialId: `cred-${n}`,
        },
        encodedChallenge: `challenge-${n}`,
      }
    },
    ceremonies: () => n,
  }
}

function token(publicKey: string) {
  return `hdr.${btoa(
    JSON.stringify({
      exp: Date.now() + 3_600_000,
      public_key: publicKey,
      session_type: SessionType.READ_WRITE,
      user_id: 'user-1',
      organization_id: 'suborg-1',
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
  return { adapter }
}

type KmsOptions = {
  /** Fail the stamp-login that follows account creation. */
  failLogin?: boolean
  /** Serves the authenticator list, so `logout` revokes rather than declines. */
  vault: { activeKey: () => string | null }
}

function stubKms(options: KmsOptions) {
  const paths: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const path = String(url)
      const body = init?.body ? JSON.parse(String(init.body)) : {}
      const json = (payload: unknown, status = 200) =>
        new Response(JSON.stringify(payload), {
          status,
          headers: { 'content-type': 'application/json' },
        })

      if (path.includes('server-info/parent-org-id')) {
        return json({ parentOrgId: 'parent-org' })
      }
      paths.push(path)

      if (path.includes('/auth/register/passkey')) {
        return json({
          userId: 'user-1',
          walletAddress: `0x${'1'.repeat(40)}`,
          subOrganizationId: 'suborg-1',
        })
      }
      if (path.includes('/auth/login/stamp')) {
        if (options.failLogin) {
          return json({ error: 'unavailable', message: 'KMS down' }, 503)
        }
        return json({ session: token(body.targetPublicKey) })
      }
      if (path.includes('auth/logout')) return json({ ok: true })
      if (path.includes('authenticators')) {
        return json({
          sessionKeys: [
            { ApiKey: options.vault.activeKey() ?? '', TurnkeyId: 'tk-1' },
          ],
        })
      }
      return json({}, 404)
    }),
  )
  const count = (suffix: string) =>
    paths.filter((p) => p.includes(suffix)).length
  return {
    creates: () => count('/auth/register/passkey'),
    logins: () => count('/auth/login/stamp'),
  }
}

const register = { type: 'passkey', mode: 'register' } as const
const login = { type: 'passkey', mode: 'login' } as const

const caught = (p: Promise<unknown>) =>
  p.then(
    () => 'RESOLVED' as const,
    (error: unknown) => error,
  )

async function wallet(options: { failLogin?: boolean } = {}) {
  const api = keyStore()
  const passkey = passkeyStamper()
  const kms = stubKms({ ...options, vault: api })
  const core = await createZeroDevWalletCore({
    projectId: 'proj',
    rpId: 'localhost',
    sessionStorage: storage().adapter,
    apiKeyStamper: api,
    passkeyStamper: passkey,
    proxyBaseUrl: 'https://kms.test.invalid/api/v1',
  })
  return { api, passkey, kms, core }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('registration: the two-rotation sequence', () => {
  it('ends on the durable key, not the registration key', async () => {
    const w = await wallet()

    await w.core.auth(register)

    const promoted = w.api.promoted()
    expect(promoted).toHaveLength(2)
    expect(w.api.activeKey()).toBe(promoted[1])
    await expect(w.core.getSession()).resolves.toMatchObject({
      publicKey: promoted[1],
    })
    expect(w.kms.creates()).toBe(1)
    expect(w.kms.logins()).toBe(1)
    expect(w.passkey.ceremonies()).toBe(1)
  })

  it('leaves the registration key live when the second rotation fails', async () => {
    const w = await wallet({ failLogin: true })

    expect(await caught(w.core.auth(register))).toBeInstanceOf(Error)

    // The account exists remotely and the key that authorized it is still held,
    // which is what makes the login retry in `registerMidFlowFailure` possible.
    const promoted = w.api.promoted()
    expect(promoted).toHaveLength(1)
    expect(w.api.activeKey()).toBe(promoted[0])
    expect(w.kms.creates()).toBe(1)
    await expect(w.core.getSession()).resolves.toBeUndefined()
  })
})

describe('registration: two at once must not make two wallets', () => {
  it('creates one account and runs one ceremony', async () => {
    const w = await wallet()

    const results = await Promise.all([
      caught(w.core.auth(register)),
      caught(w.core.auth(register)),
    ])

    expect(w.kms.creates()).toBe(1)
    expect(w.passkey.ceremonies()).toBe(1)
    expect(results.filter((r) => r === 'RESOLVED')).toHaveLength(1)
    expect(w.api.promoted()).toHaveLength(2)
  })
})

describe('registration: the unauthenticated guard', () => {
  it('refuses before touching the authenticator when a session is live', async () => {
    const w = await wallet()
    await w.core.auth(login)
    const sessionBefore = await w.core.getSession()

    const error = await caught(w.core.auth(register))

    expect((error as Error).message).toMatch(/unauthenticated wallet/i)
    expect(w.kms.creates()).toBe(0)
    expect(w.passkey.ceremonies()).toBe(0)
    await expect(w.core.getSession()).resolves.toMatchObject({
      id: sessionBefore?.id,
    })
  })

  it('allows a second wallet once the first is logged out', async () => {
    const w = await wallet()
    await w.core.auth(register)
    await expect(w.core.logout()).resolves.toBe(true)

    await w.core.auth(register)

    expect(w.kms.creates()).toBe(2)
    expect(w.passkey.ceremonies()).toBe(2)
    await expect(w.core.getSession()).resolves.toBeDefined()
  })
})
