import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { StorageAdapter } from '../storage/manager.js'
import { createZeroDevWalletCore } from './createZeroDevWalletCore.js'

// Shared mock surfaces, referenced from the (hoisted) vi.mock factories below.
const h = vi.hoisted(() => ({
  apiKeyStamper: {
    stamp: vi.fn(),
    clear: vi.fn(),
    getPublicKey: vi.fn(),
    resetKeyPair: vi.fn(),
    prepareKeyRotation: vi.fn(),
    commitKeyRotation: vi.fn(),
    sign: vi.fn(),
  },
  passkeyStamper: {
    stamp: vi.fn(),
    clear: vi.fn(),
    register: vi.fn(),
  },
  // The client object createClient() returns. apiKeyStamper/passkeyStamper are
  // assigned by the createClient mock from the config it receives.
  client: {
    apiKeyStamper: undefined as unknown,
    passkeyStamper: undefined as unknown,
    getParentOrgId: vi.fn(),
    authenticateWithOAuth: vi.fn(),
    registerWithPasskey: vi.fn(),
    loginWithStamp: vi.fn(),
    registerWithOTP: vi.fn(),
    loginWithOTP: vi.fn(),
    getAuthProxyConfigId: vi.fn(),
  },
  authProxyClient: { verifyOtp: vi.fn() },
  encryptOtpAttempt: vi.fn(),
  buildClientSignature: vi.fn(),
  toViemAccount: vi.fn(),
  transport: { name: 'mock-transport' },
}))

vi.mock('../client/index.js', () => ({
  createClient: vi.fn(
    (cfg: { apiKeyStamper: unknown; passkeyStamper: unknown }) => {
      h.client.apiKeyStamper = cfg.apiKeyStamper
      h.client.passkeyStamper = cfg.passkeyStamper
      return h.client
    },
  ),
  createAuthProxyClient: vi.fn(() => h.authProxyClient),
  zeroDevWalletTransport: vi.fn(() => h.transport),
}))
vi.mock('../adapters/viem.js', () => ({ toViemAccount: h.toViemAccount }))
vi.mock('../utils/encryptOtpAttempt.js', () => ({
  encryptOtpAttempt: h.encryptOtpAttempt,
}))
vi.mock('../utils/buildClientSignature.js', () => ({
  buildClientSignature: h.buildClientSignature,
}))

import {
  createAuthProxyClient,
  createClient,
  zeroDevWalletTransport,
} from '../client/index.js'

const BASE_TIME_MS = 1_700_000_000_000 // fixed "now" so session ids/expiry are deterministic
const SESSION_EXPIRATION_MS = 900 * 1000 // DEFAULT_SESSION_EXPIRATION_IN_SECONDS = '900'

// A parseable Turnkey session JWT
function createJwt(payload: Record<string, unknown>): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64')
  return `header.${encoded}.signature`
}
const VALID_JWT = createJwt({
  exp: 2_000_000_000, // seconds → normalizes to year ~2033
  public_key: 'jwt-public-key',
  session_type: 'SESSION_TYPE_READ_WRITE',
  user_id: 'user-1',
  organization_id: 'org-1',
})

// In-memory storage adapter (same shape used in manager.test.ts).
function createMemoryAdapter(): StorageAdapter & {
  store: Map<string, string>
} {
  const store = new Map<string, string>()
  return {
    store,
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value)
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key)
    }),
  }
}

let adapter: ReturnType<typeof createMemoryAdapter>

function baseConfig(overrides: Record<string, unknown> = {}) {
  return {
    projectId: 'proj-1',
    sessionStorage: adapter,
    rpId: 'rp.test',
    apiKeyStamper: h.apiKeyStamper as never,
    passkeyStamper: h.passkeyStamper as never,
    organizationId: 'org-explicit',
    ...overrides,
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(BASE_TIME_MS)
  vi.clearAllMocks()
  adapter = createMemoryAdapter()

  // Defaults
  h.apiKeyStamper.resetKeyPair.mockResolvedValue(undefined)
  h.apiKeyStamper.getPublicKey.mockResolvedValue('generated-pub-key')
  h.apiKeyStamper.prepareKeyRotation.mockResolvedValue('rotated-pub-key')
  h.apiKeyStamper.commitKeyRotation.mockResolvedValue(undefined)
  h.apiKeyStamper.sign.mockResolvedValue('pop-signature')
  h.apiKeyStamper.stamp.mockResolvedValue({
    stampHeaderName: 'X-Stamp',
    stampHeaderValue: 'stamp-value',
  })
  h.passkeyStamper.register.mockResolvedValue({
    attestation: {
      attestationObject: 'ao',
      clientDataJson: 'cdj',
      credentialId: 'cid',
    },
    encodedChallenge: 'challenge',
  })

  h.client.getParentOrgId.mockResolvedValue({
    parentOrgId: 'fetched-parent-org',
  })
  h.client.authenticateWithOAuth.mockResolvedValue({
    session: VALID_JWT,
    userId: 'user-1',
  })
  h.client.registerWithPasskey.mockResolvedValue({
    userId: 'user-1',
    walletAddress: '0xwallet',
    subOrganizationId: 'sub-1',
  })
  h.client.loginWithStamp.mockResolvedValue({ session: VALID_JWT })
  h.client.registerWithOTP.mockResolvedValue({ otpId: 'otp-1' })
  h.client.loginWithOTP.mockResolvedValue({ session: VALID_JWT })
  h.client.getAuthProxyConfigId.mockResolvedValue({
    authProxyConfigId: 'cfg-1',
  })

  h.authProxyClient.verifyOtp.mockResolvedValue({
    verificationToken: 'v-token',
  })
  h.encryptOtpAttempt.mockResolvedValue('encrypted-otp-bundle')
  h.buildClientSignature.mockResolvedValue('client-signature')
  h.toViemAccount.mockResolvedValue({ address: '0xViemAccount' })
})

afterEach(() => {
  vi.useRealTimers()
})

// construction / transport wiring
describe('createZeroDevWalletCore — construction', () => {
  it('builds the transport against the default KMS url when no proxyBaseUrl', async () => {
    await createZeroDevWalletCore(baseConfig())

    expect(zeroDevWalletTransport).toHaveBeenCalledWith(
      expect.objectContaining({ baseUrl: 'https://kms.zerodev.app/api/v1' }),
    )
    // The config stamper is the one the client is built with.
    expect(createClient).toHaveBeenCalledWith(
      expect.objectContaining({ apiKeyStamper: h.apiKeyStamper }),
    )
  })

  it('honors a proxyBaseUrl override', async () => {
    await createZeroDevWalletCore(
      baseConfig({ proxyBaseUrl: 'http://localhost:8787/api/v1' }),
    )

    expect(zeroDevWalletTransport).toHaveBeenCalledWith(
      expect.objectContaining({ baseUrl: 'http://localhost:8787/api/v1' }),
    )
  })

  it('falls back to the noop passkey stamper when none is supplied', async () => {
    const { passkeyStamper: _omit, ...configWithoutPasskey } = baseConfig()
    const sdk = await createZeroDevWalletCore(configWithoutPasskey as never)

    // The client is built with a (noop) passkey stamper, not undefined...
    expect(createClient).toHaveBeenCalledWith(
      expect.objectContaining({ passkeyStamper: expect.any(Object) }),
    )
    // ...and using it fails with the actionable "not configured" message
    // rather than a TypeError, keeping apiKey/OAuth/OTP flows unaffected.
    await expect(
      sdk.auth({ type: 'passkey', mode: 'register' }),
    ).rejects.toThrow(/passkeyStamper is not configured/)
  })
})

// getPublicKey
describe('getPublicKey', () => {
  it('resets the key pair before reading the public key', async () => {
    const sdk = await createZeroDevWalletCore(baseConfig())
    h.apiKeyStamper.getPublicKey.mockResolvedValue('compressed-pub-key')

    const result = await sdk.getPublicKey()

    expect(result).toBe('compressed-pub-key')
    expect(
      h.apiKeyStamper.resetKeyPair.mock.invocationCallOrder[0],
    ).toBeLessThan(h.apiKeyStamper.getPublicKey.mock.invocationCallOrder[0]!)
  })
})

// auth: oauth
describe('auth — oauth', () => {
  it('signs the sessionId, calls authenticateWithOAuth, and stores the session', async () => {
    const sdk = await createZeroDevWalletCore(baseConfig())

    const data = await sdk.auth({
      type: 'oauth',
      provider: 'google',
      sessionId: 'oauth-session-id',
    })

    expect(h.apiKeyStamper.sign).toHaveBeenCalledWith('oauth-session-id')
    expect(h.client.authenticateWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      projectId: 'proj-1',
      sessionId: 'oauth-session-id',
      popSignature: 'pop-signature',
    })
    expect(data).toEqual({ session: VALID_JWT, userId: 'user-1' })

    const stored = await sdk.getSession()
    expect(stored).toMatchObject({
      id: `session_oauth_${BASE_TIME_MS}`,
      stamperType: 'apiKey',
      userId: 'user-1',
      organizationId: 'org-1',
      token: VALID_JWT,
      expiry: 2_000_000_000,
    })
  })

  it('does not store a session when the response has no session token', async () => {
    h.client.authenticateWithOAuth.mockResolvedValue({ userId: 'user-1' })
    const sdk = await createZeroDevWalletCore(baseConfig())

    await sdk.auth({ type: 'oauth', provider: 'google', sessionId: 's' })

    expect(await sdk.getSession()).toBeUndefined()
  })
})

// auth: passkey register
describe('auth — passkey register', () => {
  it('registers, rotates the key, and commits ONLY after the server accepts login', async () => {
    const sdk = await createZeroDevWalletCore(baseConfig())

    const data = await sdk.auth({ type: 'passkey', mode: 'register' })

    // Register uses the configured rpId.
    expect(h.passkeyStamper.register).toHaveBeenCalledWith(
      expect.objectContaining({
        rp: expect.objectContaining({ id: 'rp.test' }),
      }),
    )
    // The registration payload is security-relevant — pin every field so a
    // swapped/dropped arg (e.g. wrong encodedPublicKey, missing challenge) fails.
    expect(h.client.registerWithPasskey).toHaveBeenCalledWith({
      attestation: {
        attestationObject: 'ao',
        clientDataJson: 'cdj',
        credentialId: 'cid',
      },
      challenge: 'challenge',
      projectId: 'proj-1',
      encodedPublicKey: 'generated-pub-key',
    })
    // Login uses the rotated (pending) public key against the resolved org.
    expect(h.client.loginWithStamp).toHaveBeenCalledWith(
      expect.objectContaining({
        targetPublicKey: 'rotated-pub-key',
        projectId: 'proj-1',
        organizationId: 'org-explicit',
      }),
    )
    // Safety-critical ordering: prepare → login → commit. Committing before
    // the server accepts the new key would strand the wallet.
    expect(
      h.apiKeyStamper.prepareKeyRotation.mock.invocationCallOrder[0]!,
    ).toBeLessThan(h.client.loginWithStamp.mock.invocationCallOrder[0]!)
    expect(h.client.loginWithStamp.mock.invocationCallOrder[0]!).toBeLessThan(
      h.apiKeyStamper.commitKeyRotation.mock.invocationCallOrder[0]!,
    )

    // Returns the registration response (not the login response).
    expect(data).toMatchObject({ userId: 'user-1', walletAddress: '0xwallet' })

    // Session uses the default expiration window, not the JWT exp.
    const stored = await sdk.getSession()
    expect(stored).toMatchObject({
      id: `session_indexedDb_${BASE_TIME_MS}`,
      stamperType: 'apiKey',
      expiry: BASE_TIME_MS + SESSION_EXPIRATION_MS,
      token: VALID_JWT,
    })
  })

  it('throws when a public key cannot be generated', async () => {
    h.apiKeyStamper.getPublicKey.mockResolvedValue(null)
    const sdk = await createZeroDevWalletCore(baseConfig())

    await expect(
      sdk.auth({ type: 'passkey', mode: 'register' }),
    ).rejects.toThrow('Failed to get public key')
  })
})

// auth: passkey login
describe('auth — passkey login', () => {
  it('logs in with the passkey stamper using the freshly generated key (no rotation)', async () => {
    const sdk = await createZeroDevWalletCore(baseConfig())

    const loginData = await sdk.auth({ type: 'passkey', mode: 'login' })

    expect(h.client.loginWithStamp).toHaveBeenCalledWith(
      expect.objectContaining({
        targetPublicKey: 'generated-pub-key',
        stampWith: 'passkey',
        organizationId: 'org-explicit',
      }),
    )
    // Login path does not rotate keys.
    expect(h.apiKeyStamper.prepareKeyRotation).not.toHaveBeenCalled()
    expect(h.apiKeyStamper.commitKeyRotation).not.toHaveBeenCalled()
    expect(loginData).toEqual({ session: VALID_JWT })

    expect(await sdk.getSession()).toMatchObject({
      stamperType: 'apiKey',
      expiry: BASE_TIME_MS + SESSION_EXPIRATION_MS,
    })
  })
})

// auth: otp verify
describe('auth — otp', () => {
  it('threads the OTP through encrypt → auth-proxy verify → client signature → login', async () => {
    const sdk = await createZeroDevWalletCore(baseConfig())

    const data = await sdk.auth({
      type: 'otp',
      mode: 'verifyOtp',
      otpId: 'otp-1',
      otpCode: '123456',
      otpEncryptionTargetBundle: 'target-bundle',
    })

    // OTP is HPKE-sealed to the freshly generated key.
    expect(h.encryptOtpAttempt).toHaveBeenCalledWith({
      otpCode: '123456',
      publicKey: 'generated-pub-key',
      encryptionTargetBundle: 'target-bundle',
    })
    // Encrypted bundle goes to the auth proxy, keyed by the fetched config id.
    expect(createAuthProxyClient).toHaveBeenCalledWith({
      authProxyConfigId: 'cfg-1',
    })
    expect(h.authProxyClient.verifyOtp).toHaveBeenCalledWith({
      otpId: 'otp-1',
      encryptedOtpBundle: 'encrypted-otp-bundle',
    })
    // verificationToken flows into both the signature and the backend login.
    expect(h.buildClientSignature).toHaveBeenCalledWith(
      expect.objectContaining({
        verificationToken: 'v-token',
        publicKey: 'generated-pub-key',
      }),
    )
    expect(h.client.loginWithOTP).toHaveBeenCalledWith({
      verificationToken: 'v-token',
      clientSignature: 'client-signature',
      projectId: 'proj-1',
    })
    expect(data).toEqual({ session: VALID_JWT })

    expect(await sdk.getSession()).toMatchObject({
      id: `session_otp_${BASE_TIME_MS}`,
      stamperType: 'apiKey',
      token: VALID_JWT,
    })
  })

  it('sendOtp initiates OTP without touching keys or storage', async () => {
    const sdk = await createZeroDevWalletCore(baseConfig())

    const data = await sdk.auth({
      type: 'otp',
      mode: 'sendOtp',
      email: 'a@b.com',
      contact: { type: 'email', contact: 'a@b.com' },
    })

    expect(h.client.registerWithOTP).toHaveBeenCalledWith({
      email: 'a@b.com',
      contact: { type: 'email', contact: 'a@b.com' },
      projectId: 'proj-1',
    })
    expect(data).toEqual({ otpId: 'otp-1' })
    expect(h.apiKeyStamper.resetKeyPair).not.toHaveBeenCalled()
    expect(await sdk.getSession()).toBeUndefined()
  })

  it('caches the auth-proxy config id across verifications', async () => {
    const sdk = await createZeroDevWalletCore(baseConfig())
    const verify = () =>
      sdk.auth({
        type: 'otp',
        mode: 'verifyOtp',
        otpId: 'otp-1',
        otpCode: '111111',
        otpEncryptionTargetBundle: 'bundle',
      })

    await verify()
    await verify()

    expect(h.client.getAuthProxyConfigId).toHaveBeenCalledTimes(1)
    expect(h.authProxyClient.verifyOtp).toHaveBeenCalledTimes(2)
  })

  it('throws when a public key cannot be generated', async () => {
    h.apiKeyStamper.getPublicKey.mockResolvedValue(null)
    const sdk = await createZeroDevWalletCore(baseConfig())

    await expect(
      sdk.auth({
        type: 'otp',
        mode: 'verifyOtp',
        otpId: 'otp-1',
        otpCode: '1',
        otpEncryptionTargetBundle: 'b',
      }),
    ).rejects.toThrow('Failed to get public key')
  })
})

// auth: magicLink
describe('auth — magicLink normalization', () => {
  it('send is normalized to an email OTP registration', async () => {
    const sdk = await createZeroDevWalletCore(baseConfig())

    await sdk.auth({
      type: 'magicLink',
      mode: 'send',
      email: 'user@example.com',
    })

    expect(h.client.registerWithOTP).toHaveBeenCalledWith({
      email: 'user@example.com',
      contact: { type: 'email', contact: 'user@example.com' },
      projectId: 'proj-1',
    })
  })

  it('verify is normalized into the OTP verify flow', async () => {
    const sdk = await createZeroDevWalletCore(baseConfig())

    await sdk.auth({
      type: 'magicLink',
      mode: 'verify',
      otpId: 'otp-9',
      code: '654321',
      otpEncryptionTargetBundle: 'ml-bundle',
    })

    expect(h.encryptOtpAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        otpCode: '654321',
        encryptionTargetBundle: 'ml-bundle',
      }),
    )
    expect(h.authProxyClient.verifyOtp).toHaveBeenCalledWith(
      expect.objectContaining({ otpId: 'otp-9' }),
    )
    expect(await sdk.getSession()).toMatchObject({ token: VALID_JWT })
  })
})

// org resolution
describe('organization id resolution', () => {
  it('fetches the parent org from the backend when no organizationId is configured', async () => {
    const sdk = await createZeroDevWalletCore(
      baseConfig({ organizationId: undefined }),
    )

    await sdk.auth({ type: 'passkey', mode: 'login' })

    expect(h.client.getParentOrgId).toHaveBeenCalled()
    expect(h.client.loginWithStamp).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'fetched-parent-org' }),
    )
  })
})

// refreshSession
describe('refreshSession', () => {
  it('throws when there is no active session', async () => {
    const sdk = await createZeroDevWalletCore(baseConfig())

    await expect(sdk.refreshSession()).rejects.toThrow('No active session')
  })

  it('rotates the key and swaps the stored session (prepare → login → commit)', async () => {
    const sdk = await createZeroDevWalletCore(baseConfig())
    await sdk.auth({ type: 'oauth', provider: 'google', sessionId: 's' })
    const oldId = (await sdk.getSession())?.id

    const refreshed = await sdk.refreshSession()

    expect(h.client.loginWithStamp).toHaveBeenCalledWith(
      expect.objectContaining({
        targetPublicKey: 'rotated-pub-key',
        stampWith: 'apiKey',
        organizationId: 'org-explicit',
      }),
    )
    expect(
      h.apiKeyStamper.prepareKeyRotation.mock.invocationCallOrder[0]!,
    ).toBeLessThan(h.client.loginWithStamp.mock.invocationCallOrder[0]!)
    expect(h.client.loginWithStamp.mock.invocationCallOrder[0]!).toBeLessThan(
      h.apiKeyStamper.commitKeyRotation.mock.invocationCallOrder[0]!,
    )

    // Old session replaced by a fresh indexedDb session.
    expect(refreshed?.id).toBe(`session_indexedDb_${BASE_TIME_MS}`)
    expect(refreshed?.id).not.toBe(oldId)
    const all = await sdk.getAllSessions()
    expect(Object.keys(all)).toEqual([`session_indexedDb_${BASE_TIME_MS}`])
  })

  it('throws for a non-apiKey session type', async () => {
    // Seed a restored passkey-type session directly into storage. NOTE: no SDK
    // flow currently produces stamperType:'passkey' (passkey login/register both
    // store 'apiKey'), so this guard is unreachable via the public API today —
    // the test protects it as a regression guard for future/restored sessions.
    // It couples to the manager's private storage keys (@zerodev/*); a rename
    // there would break this test without any change to core's own logic.
    const key = 'session:passkey'
    const passkeySession = {
      id: key,
      userId: 'user-1',
      organizationId: 'org-1',
      stamperType: 'passkey',
      token: 't',
      expiry: 2_000_000_000,
      createdAt: BASE_TIME_MS,
    }
    adapter.store.set(key, JSON.stringify(passkeySession))
    adapter.store.set('@zerodev/sessions', JSON.stringify([key]))
    adapter.store.set('@zerodev/active_session', key)

    const sdk = await createZeroDevWalletCore(baseConfig())

    await expect(sdk.refreshSession()).rejects.toThrow('Invalid session type')
    expect(h.apiKeyStamper.prepareKeyRotation).not.toHaveBeenCalled()
  })

  it('refreshes the session named by an explicit sessionId, not the active one', async () => {
    const sdk = await createZeroDevWalletCore(baseConfig())
    await sdk.auth({ type: 'oauth', provider: 'google', sessionId: 'a' })
    const targetId = (await sdk.getSession())!.id
    vi.setSystemTime(BASE_TIME_MS + 1000)
    await sdk.auth({ type: 'oauth', provider: 'google', sessionId: 'b' })
    const activeId = (await sdk.getSession())!.id // now the active session

    const refreshed = await sdk.refreshSession(targetId)

    // The explicitly-named session was rotated away; the active one is untouched.
    const all = await sdk.getAllSessions()
    expect(all[targetId]).toBeUndefined()
    expect(all[activeId]).toBeDefined()
    expect(refreshed?.id).toBe(`session_indexedDb_${BASE_TIME_MS + 1000}`)
  })
})

// session management
describe('session management', () => {
  it('switchSession activates the named session and returns it', async () => {
    const sdk = await createZeroDevWalletCore(baseConfig())
    await sdk.auth({ type: 'oauth', provider: 'google', sessionId: 'a' })
    const firstId = (await sdk.getSession())!.id
    vi.setSystemTime(BASE_TIME_MS + 1000)
    await sdk.auth({ type: 'oauth', provider: 'google', sessionId: 'b' })

    const switched = await sdk.switchSession(firstId)

    expect(switched?.id).toBe(firstId)
    expect((await sdk.getSession())?.id).toBe(firstId)
  })

  it('clearSession removes only the named session', async () => {
    const sdk = await createZeroDevWalletCore(baseConfig())
    await sdk.auth({ type: 'oauth', provider: 'google', sessionId: 'a' })
    const firstId = (await sdk.getSession())!.id
    vi.setSystemTime(BASE_TIME_MS + 1000)
    await sdk.auth({ type: 'oauth', provider: 'google', sessionId: 'b' })
    const secondId = (await sdk.getSession())!.id

    await sdk.clearSession(firstId)

    const all = await sdk.getAllSessions()
    expect(all[firstId]).toBeUndefined()
    expect(all[secondId]).toBeDefined()
  })
})

// runtime guards (malformed input crossing a JS/non-TS boundary)
describe('auth — runtime guards', () => {
  it('throws on an unknown auth type', async () => {
    const sdk = await createZeroDevWalletCore(baseConfig())

    await expect(sdk.auth({ type: 'unknown' } as never)).rejects.toThrow(
      /Unknown auth type/,
    )
  })

  it('throws when a passkey auth has no valid mode', async () => {
    const sdk = await createZeroDevWalletCore(baseConfig())

    await expect(
      sdk.auth({ type: 'passkey', mode: 'bogus' } as never),
    ).rejects.toThrow('Passkey authentication requires passkey parameter')
  })

  it('throws when an otp auth has no valid mode', async () => {
    const sdk = await createZeroDevWalletCore(baseConfig())

    await expect(sdk.auth({ type: 'otp' } as never)).rejects.toThrow(
      'OTP authentication requires mode parameter',
    )
  })
})

// logout
describe('logout', () => {
  it('clears all sessions, resets the key pair, and returns true', async () => {
    const sdk = await createZeroDevWalletCore(baseConfig())
    await sdk.auth({ type: 'oauth', provider: 'google', sessionId: 's' })

    const result = await sdk.logout()

    expect(result).toBe(true)
    expect(h.apiKeyStamper.resetKeyPair).toHaveBeenCalled()
    expect(await sdk.getSession()).toBeUndefined()
    expect(await sdk.getAllSessions()).toEqual({})
  })
})

// toAccount
describe('toAccount', () => {
  it('throws when there is no active session', async () => {
    const sdk = await createZeroDevWalletCore(baseConfig())

    await expect(sdk.toAccount()).rejects.toThrow('No active session')
  })

  it('delegates to toViemAccount with the active session context', async () => {
    const sdk = await createZeroDevWalletCore(baseConfig())
    await sdk.auth({ type: 'oauth', provider: 'google', sessionId: 's' })

    const account = await sdk.toAccount()

    expect(account).toEqual({ address: '0xViemAccount' })
    expect(h.toViemAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        client: h.client,
        organizationId: 'org-1',
        projectId: 'proj-1',
        getToken: expect.any(Function),
      }),
    )
    // The injected getToken resolves the active session's token.
    const { getToken } = h.toViemAccount.mock.calls[0]![0] as {
      getToken: () => Promise<string>
    }
    expect(await getToken()).toBe(VALID_JWT)
  })
})
