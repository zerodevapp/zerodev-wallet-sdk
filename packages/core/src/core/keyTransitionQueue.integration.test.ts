/**
 * Flow: the key-transition queue in `createZeroDevWalletCore`.
 *
 * `withKeyTransition` serializes construction, `getPublicKey`, `refreshSession`,
 * the four authenticated `auth` branches and `logout` through `keyTransitionTail`,
 * a module-level promise chain shared by every core in the process because the key
 * vault is one physical slot. `sendOtp` is outside it.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ApiKeyStamper, PasskeyStamper } from '../stampers/types.js'
import type { StorageAdapter } from '../storage/manager.js'
import { SessionType } from '../types/session.js'
import { createZeroDevWalletCore } from './createZeroDevWalletCore.js'

const sessionKey = (nth: number) => `02${String(nth).padStart(64, '0')}`

/** Opened by the test, so ordering never depends on a timer. */
function gate() {
  let open!: () => void
  const wait = new Promise<void>((resolve) => {
    open = resolve
  })
  return { open, wait }
}

type KeyStoreScript = {
  /** Fail every `commitKeyRotation`. */
  commitFails?: boolean
  /** Fail only the first `commitKeyRotation`. */
  commitFailsOnce?: boolean
}

/** Mints a distinct key per `prepareKeyRotation` and promotes it on commit. */
function keyStore(script: KeyStoreScript = {}): ApiKeyStamper & {
  activeKey: () => string | null
  promoted: () => string[]
} {
  let minted = 0
  let active: string | null = null
  let pending: string | null = null
  let commits = 0
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
      const attempt = commits++
      if (script.commitFails || (script.commitFailsOnce && attempt === 0)) {
        throw new Error('key store commit failed')
      }
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
    /** Every key that became live, in order. */
    promoted: () => [...promotions],
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

/** Backed by a plain Map so a second instance can read the same store. */
function storage(store = new Map<string, string>()) {
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

type KmsOptions = {
  /** Answers the authenticator list with this vault's key, so `logout` revokes
   * instead of declining on an unrecognised key. */
  vault?: { activeKey: () => string | null }
  /** Holds every stamp-login until opened. */
  stampGate?: Promise<void>
}

function stubKms(options: KmsOptions = {}) {
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
      if (path.includes('/auth/login/stamp')) {
        if (options.stampGate) await options.stampGate
        return json({ session: token(body.targetPublicKey) })
      }
      if (path.includes('/auth/init/otp')) {
        return json({ otpId: 'otp-1', otpEncryptionTargetBundle: 'bundle' })
      }
      if (path.includes('authenticators')) {
        return json({
          sessionKeys: [
            { ApiKey: options.vault?.activeKey() ?? '', TurnkeyId: 'tk-1' },
          ],
        })
      }
      if (path.includes('logout')) return json({ ok: true })
      return json({}, 404)
    }),
  )
}

const build = (
  api: ApiKeyStamper,
  adapter: StorageAdapter,
  projectId = 'proj',
) =>
  createZeroDevWalletCore({
    projectId,
    rpId: 'localhost',
    sessionStorage: adapter,
    apiKeyStamper: api,
    passkeyStamper,
    proxyBaseUrl: 'https://kms.test.invalid/api/v1',
  })

const login = { type: 'passkey', mode: 'login' } as const
const sendOtp = {
  type: 'otp',
  mode: 'sendOtp',
  email: 'user@test.invalid',
  contact: { type: 'email', contact: 'user@test.invalid' },
} as const

const caught = (p: Promise<unknown>) =>
  p.then(
    () => 'RESOLVED' as const,
    (error: unknown) => error,
  )

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('key transitions: the control', () => {
  it('leaves each login bound to the key the vault actually holds', async () => {
    const api = keyStore()
    stubKms({ vault: api })
    const core = await build(api, storage().adapter)

    await core.auth(login)
    const first = await core.getSession()
    await core.auth(login)
    const second = await core.getSession()

    expect(first?.publicKey).not.toBe(second?.publicKey)
    expect(second?.publicKey).toBe(api.activeKey())
  })
})

describe('key transitions: one failure must not brick the process', () => {
  it('runs a later transition on the same instance', async () => {
    const api = keyStore({ commitFailsOnce: true })
    stubKms({ vault: api })
    const core = await build(api, storage().adapter)
    expect(await caught(core.auth(login))).toBeInstanceOf(Error)

    await core.auth(login)

    await expect(core.getSession()).resolves.toBeDefined()
  })

  it('runs a later transition on a DIFFERENT instance', async () => {
    const failing = keyStore({ commitFails: true })
    stubKms({ vault: failing })
    const doomed = await build(failing, storage().adapter, 'project-a')
    const healthy = keyStore()
    const other = await build(healthy, storage().adapter, 'project-b')

    expect(await caught(doomed.auth(login))).toBeInstanceOf(Error)
    await other.auth(login)

    await expect(other.getSession()).resolves.toBeDefined()
    expect(healthy.activeKey()).toBe(sessionKey(1))
  })
})

describe('key transitions: concurrent callers are serialized', () => {
  it('leaves two refreshes with the session the vault can sign for', async () => {
    const api = keyStore()
    stubKms({ vault: api })
    const core = await build(api, storage().adapter)
    await core.auth(login)

    const [first, second] = await Promise.all([
      core.refreshSession(),
      core.refreshSession(),
    ])

    expect(first?.publicKey).not.toBe(second?.publicKey)
    await expect(core.getSession()).resolves.toMatchObject({
      publicKey: api.activeKey(),
    })
  })

  it('gives two instances sharing one vault a key each', async () => {
    const vault = keyStore()
    stubKms({ vault })
    const first = await build(vault, storage().adapter, 'project-a')
    const second = await build(vault, storage().adapter, 'project-b')

    await Promise.all([first.auth(login), second.auth(login)])

    const one = await first.getSession()
    const two = await second.getSession()
    expect(one?.publicKey).not.toBe(two?.publicKey)
    expect(vault.promoted()).toEqual([one?.publicKey, two?.publicKey])
    expect(vault.activeKey()).toBe(two?.publicKey)
  })
})

describe('key transitions: logout ordered against a refresh', () => {
  it('completes a refresh issued before logout, then revokes', async () => {
    const api = keyStore()
    stubKms({ vault: api })
    const core = await build(api, storage().adapter)
    await core.auth(login)

    const refreshed = core.refreshSession()
    const out = core.logout()

    await expect(refreshed).resolves.toBeDefined()
    await expect(out).resolves.toBe(true)
    expect(api.activeKey()).toBeNull()
    await expect(core.getSession()).resolves.toBeUndefined()
  })

  it('refuses a refresh queued behind logout rather than minting a key', async () => {
    const api = keyStore()
    stubKms({ vault: api })
    const core = await build(api, storage().adapter)
    await core.auth(login)

    const out = core.logout()
    const refreshed = caught(core.refreshSession())

    await expect(out).resolves.toBe(true)
    expect(await refreshed).toBeInstanceOf(Error)
    expect((await refreshed) as Error).toHaveProperty(
      'message',
      expect.stringMatching(/no active session/i),
    )
    expect(api.activeKey()).toBeNull()
    await expect(core.getSession()).resolves.toBeUndefined()
  })
})

describe('key transitions: what must NOT be queued', () => {
  it('sends an OTP while a key transition is still in flight', async () => {
    const api = keyStore()
    const held = gate()
    stubKms({ vault: api, stampGate: held.wait })
    const core = await build(api, storage().adapter)
    const blocked = caught(core.auth(login))

    await expect(core.auth(sendOtp)).resolves.toMatchObject({ otpId: 'otp-1' })

    held.open()
    expect(await blocked).toBe('RESOLVED')
    expect(api.activeKey()).toBe(sessionKey(1))
  })
})
