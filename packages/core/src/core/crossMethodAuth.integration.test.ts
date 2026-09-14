/**
 * Flow: switching authentication method on a live session.
 *
 * `passkey` register refuses when a session is active; `oauth` and `otp`/`magicLink`
 * verify do not — they rotate the key and replace the session. Each session records
 * the method that created it in its `id` prefix (`indexedDb`, `oauth`, `otp`).
 * `otp` verify is drivable only to failure here: `encryptOtpAttempt` pins the HPKE
 * envelope, so no valid bundle can be forged in-process.
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
    signPending: async () => 'popsig',
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

function stubKms(
  oauth: { bindTo: () => string | null },
  vault: { activeKey: () => string | null },
) {
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
        return json({ session: token(body.targetPublicKey) })
      }
      if (path.includes('/auth/oauth')) {
        const bound = oauth.bindTo()
        return json({ session: bound ? token(bound) : undefined })
      }
      if (path.includes('/auth/init/otp')) {
        return json({ otpId: 'otp-1', otpEncryptionTargetBundle: 'bundle-1' })
      }
      if (path.includes('server-info/auth-proxy-id')) {
        return json({ authProxyConfigId: 'proxy-1' })
      }
      if (path.includes('auth/logout')) return json({ ok: true })
      if (path.includes('authenticators')) {
        return json({
          sessionKeys: [{ ApiKey: vault.activeKey() ?? '', TurnkeyId: 'tk-1' }],
        })
      }
      return json({}, 404)
    }),
  )
}

const passkeyLogin = { type: 'passkey', mode: 'login' } as const
/** The bundle cannot be forged, so this reaches `encryptOtpAttempt` and stops. */
const verifyOtp = {
  type: 'otp',
  mode: 'verifyOtp',
  otpId: 'otp-1',
  otpCode: '123456',
  otpEncryptionTargetBundle: 'not-a-real-bundle',
} as const
const verifyMagicLink = {
  type: 'magicLink',
  mode: 'verify',
  otpId: 'otp-1',
  code: '123456',
  otpEncryptionTargetBundle: 'not-a-real-bundle',
} as const

const caught = (p: Promise<unknown>) =>
  p.then(
    () => 'RESOLVED' as const,
    (error: unknown) => error,
  )

async function signedIn() {
  const api = keyStore()
  let handedOff: string | null = null
  stubKms({ bindTo: () => handedOff }, api)
  const core = await createZeroDevWalletCore({
    projectId: 'proj',
    rpId: 'localhost',
    sessionStorage: storage().adapter,
    apiKeyStamper: api,
    passkeyStamper,
    proxyBaseUrl: 'https://kms.test.invalid/api/v1',
  })
  return {
    api,
    core,
    /** Prepare the key OAuth will be handed, as `authenticateOAuth` does. */
    async oauth() {
      handedOff = await core.getPublicKey()
      return core.auth({ type: 'oauth', provider: 'google', sessionId: 'sid' })
    },
  }
}

/** One session, and the key it names is the one the vault holds. */
async function expectSingleUsableSession(w: {
  api: { activeKey: () => string | null }
  core: Awaited<ReturnType<typeof signedIn>>['core']
}) {
  const session = await w.core.getSession()
  expect(Object.keys(await w.core.getAllSessions())).toHaveLength(1)
  expect(session?.publicKey).toBe(w.api.activeKey())
  return session
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('cross-method: a second method replaces the session', () => {
  it('moves from passkey to oauth, leaving one usable session', async () => {
    const w = await signedIn()
    await w.core.auth(passkeyLogin)
    const first = await expectSingleUsableSession(w)

    await w.oauth()

    const second = await expectSingleUsableSession(w)
    expect(second?.id).not.toBe(first?.id)
    expect(second?.id).toMatch(/^session_oauth_/)
    expect(w.api.promoted()).toHaveLength(2)
  })

  it('moves from oauth to passkey, leaving one usable session', async () => {
    const w = await signedIn()
    await w.oauth()
    const first = await expectSingleUsableSession(w)

    await w.core.auth(passkeyLogin)

    const second = await expectSingleUsableSession(w)
    expect(second?.id).not.toBe(first?.id)
    expect(second?.id).toMatch(/^session_indexedDb_/)
    expect(w.api.promoted()).toHaveLength(2)
  })
})

describe('cross-method: a failed second method must not cost the first', () => {
  it('keeps the session and key when an otp verify cannot be sealed', async () => {
    const w = await signedIn()
    await w.core.auth(passkeyLogin)
    const before = await expectSingleUsableSession(w)

    const error = await caught(w.core.auth(verifyOtp))

    expect(error).toBeInstanceOf(Error)
    const after = await expectSingleUsableSession(w)
    expect(after?.id).toBe(before?.id)
    expect(w.api.promoted()).toHaveLength(1)
  })

  it('keeps the session and key when a magicLink verify cannot be sealed', async () => {
    // A distinct branch: `magicLink` normalizes into the otp params before
    // reaching the same guard.
    const w = await signedIn()
    await w.core.auth(passkeyLogin)
    const before = await expectSingleUsableSession(w)

    const error = await caught(w.core.auth(verifyMagicLink))

    expect(error).toBeInstanceOf(Error)
    const after = await expectSingleUsableSession(w)
    expect(after?.id).toBe(before?.id)
    expect(w.api.promoted()).toHaveLength(1)
  })
})
