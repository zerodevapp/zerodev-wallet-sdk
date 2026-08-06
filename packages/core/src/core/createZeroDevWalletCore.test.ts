import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RestRequestError } from '../errors/request.js'
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
    stampPending: vi.fn(),
    signPending: vi.fn(),
    commitKeyRotation: vi.fn(),
    discardKeyRotation: vi.fn(),
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
    getAuthenticators: vi.fn(),
    logout: vi.fn(),
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

// A parseable Turnkey session JWT
function createJwt(payload: Record<string, unknown>): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64')
  return `header.${encoded}.signature`
}
const VALID_JWT = createJwt({
  exp: 2_000_000_000, // seconds → normalizes to year ~2033
  public_key: 'rotated-pub-key',
  session_type: 'SESSION_TYPE_READ_WRITE',
  user_id: 'user-1',
  organization_id: 'org-1',
})

// In-memory storage adapter (same shape used in manager.test.ts).
function createMemoryAdapter() {
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
  } satisfies StorageAdapter & { store: Map<string, string> }
}

let adapter: ReturnType<typeof createMemoryAdapter>

function invocationOrder(
  mock: { mock: { invocationCallOrder: number[] } },
  index = 0,
): number {
  const order = mock.mock.invocationCallOrder[index]
  if (order === undefined) throw new Error(`Expected mock invocation ${index}`)
  return order
}

async function activeSessionId(
  sdk: Awaited<ReturnType<typeof createZeroDevWalletCore>>,
): Promise<string> {
  const session = await sdk.getSession()
  if (!session) throw new Error('Expected active session')
  return session.id
}

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
  h.apiKeyStamper.clear.mockResolvedValue(undefined)
  h.apiKeyStamper.getPublicKey.mockResolvedValue('rotated-pub-key')
  h.apiKeyStamper.prepareKeyRotation.mockResolvedValue('rotated-pub-key')
  h.apiKeyStamper.stampPending.mockResolvedValue({
    stampHeaderName: 'X-Stamp',
    stampHeaderValue: 'pending-stamp-value',
  })
  h.apiKeyStamper.signPending.mockResolvedValue('pop-signature')
  h.apiKeyStamper.commitKeyRotation.mockResolvedValue(undefined)
  h.apiKeyStamper.discardKeyRotation.mockResolvedValue(undefined)
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
  h.client.getAuthenticators.mockResolvedValue({
    oauths: null,
    passkeys: null,
    emailContacts: null,
    apiKeys: null,
    sessionKeys: [
      {
        ApiKey: 'rotated-pub-key',
        TurnkeyId: 'turnkey-session-key-1',
      },
    ],
  })
  h.client.logout.mockResolvedValue({})

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
  it('drops an expired restored session before account creation', async () => {
    const sessionId = 'expired-session'
    adapter.store.set(
      sessionId,
      JSON.stringify({
        id: sessionId,
        userId: 'user-1',
        organizationId: 'org-1',
        stamperType: 'apiKey',
        token: VALID_JWT,
        expiry: BASE_TIME_MS / 1_000 - 1,
        createdAt: BASE_TIME_MS - 60_000,
      }),
    )
    adapter.store.set('@zerodev/sessions', JSON.stringify([sessionId]))
    adapter.store.set('@zerodev/active_session', sessionId)

    const sdk = await createZeroDevWalletCore(baseConfig())

    await expect(sdk.getSession()).resolves.toBeUndefined()
    await expect(sdk.toAccount()).rejects.toThrow('No active session')
    expect(h.toViemAccount).not.toHaveBeenCalled()
    expect(adapter.store.has(sessionId)).toBe(false)
  })

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
  it('does not replace the live session key while preparing OAuth', async () => {
    const sdk = await createZeroDevWalletCore(baseConfig())
    await sdk.auth({ type: 'oauth', provider: 'google', sessionId: 'existing' })
    h.apiKeyStamper.prepareKeyRotation.mockClear()
    h.apiKeyStamper.resetKeyPair.mockClear()

    const result = await sdk.getPublicKey()

    expect(result).toBe('rotated-pub-key')
    expect(h.apiKeyStamper.prepareKeyRotation).toHaveBeenCalledOnce()
    expect(h.apiKeyStamper.resetKeyPair).not.toHaveBeenCalled()
  })

  it('reuses one pending key across duplicate OAuth preparation calls', async () => {
    const sdk = await createZeroDevWalletCore(baseConfig())

    const [first, second] = await Promise.all([
      sdk.getPublicKey(),
      sdk.getPublicKey(),
    ])

    expect(first).toBe(second)
    expect(h.apiKeyStamper.prepareKeyRotation).toHaveBeenCalledOnce()
  })

  it('does not reuse a stale OAuth key after another auth flow rotates it', async () => {
    h.apiKeyStamper.prepareKeyRotation
      .mockResolvedValueOnce('oauth-pending-key')
      .mockResolvedValueOnce('rotated-pub-key')
      .mockResolvedValueOnce('fresh-oauth-key')
    const sdk = await createZeroDevWalletCore(baseConfig())

    await expect(sdk.getPublicKey()).resolves.toBe('oauth-pending-key')
    await sdk.auth({
      type: 'otp',
      mode: 'verifyOtp',
      otpId: 'otp-1',
      otpCode: '123456',
      otpEncryptionTargetBundle: 'bundle',
    })

    await expect(sdk.getPublicKey()).resolves.toBe('fresh-oauth-key')
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

    expect(h.apiKeyStamper.signPending).toHaveBeenCalledWith('oauth-session-id')
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

  it('recovers a committed key if final session persistence fails', async () => {
    const sdk = await createZeroDevWalletCore(baseConfig())
    adapter.setItem.mockImplementation((key: string, value: string) => {
      if (key.includes('session_oauth_')) throw new Error('storage failed')
      adapter.store.set(key, value)
    })

    await expect(
      sdk.auth({ type: 'oauth', provider: 'google', sessionId: 's' }),
    ).rejects.toThrow('storage failed')
    expect(adapter.store.has('@zerodev/session_transition')).toBe(true)

    adapter.setItem.mockImplementation((key: string, value: string) => {
      adapter.store.set(key, value)
    })
    const recoveredSdk = await createZeroDevWalletCore(baseConfig())

    await expect(recoveredSdk.getSession()).resolves.toMatchObject({
      token: VALID_JWT,
      publicKey: 'rotated-pub-key',
    })
    expect(adapter.store.has('@zerodev/session_transition')).toBe(false)
  })

  it('recovers when key commit throws after the key became durable', async () => {
    h.apiKeyStamper.commitKeyRotation.mockRejectedValueOnce(
      new Error('commit acknowledgement lost'),
    )
    const sdk = await createZeroDevWalletCore(baseConfig())

    await expect(
      sdk.auth({ type: 'oauth', provider: 'google', sessionId: 's' }),
    ).resolves.toMatchObject({ session: VALID_JWT })

    await expect(sdk.getSession()).resolves.toMatchObject({
      token: VALID_JWT,
      publicKey: 'rotated-pub-key',
    })
    expect(adapter.store.has('@zerodev/session_transition')).toBe(false)
  })

  it('preserves the old key and session when transition staging fails', async () => {
    const sdk = await createZeroDevWalletCore(baseConfig())
    await sdk.auth({ type: 'oauth', provider: 'google', sessionId: 'existing' })
    const existingSession = await sdk.getSession()
    h.apiKeyStamper.commitKeyRotation.mockClear()
    h.apiKeyStamper.discardKeyRotation.mockClear()
    adapter.setItem.mockImplementation((key: string, value: string) => {
      if (key === '@zerodev/session_transition') {
        throw new Error('journal unavailable')
      }
      adapter.store.set(key, value)
    })

    await expect(sdk.refreshSession()).rejects.toThrow('journal unavailable')

    await expect(sdk.getSession()).resolves.toEqual(existingSession)
    expect(h.apiKeyStamper.commitKeyRotation).not.toHaveBeenCalled()
    expect(h.apiKeyStamper.discardKeyRotation).toHaveBeenCalled()
  })

  it('preserves the old state when key commit fails before activation', async () => {
    const sdk = await createZeroDevWalletCore(baseConfig())
    await sdk.auth({ type: 'oauth', provider: 'google', sessionId: 'existing' })
    const existingSession = await sdk.getSession()
    h.apiKeyStamper.prepareKeyRotation.mockResolvedValueOnce('new-public-key')
    h.apiKeyStamper.getPublicKey.mockResolvedValue('rotated-pub-key')
    h.client.loginWithStamp.mockResolvedValueOnce({
      session: createJwt({
        exp: 2_000_000_000,
        public_key: 'new-public-key',
        session_type: 'SESSION_TYPE_READ_WRITE',
        user_id: 'user-1',
        organization_id: 'org-1',
      }),
    })
    h.apiKeyStamper.commitKeyRotation.mockRejectedValueOnce(
      new Error('commit failed before activation'),
    )

    await expect(sdk.refreshSession()).rejects.toThrow(
      'commit failed before activation',
    )

    await expect(sdk.getSession()).resolves.toEqual(existingSession)
    expect(adapter.store.has('@zerodev/session_transition')).toBe(false)
  })

  it.each(['session record', 'session index', 'active pointer'])(
    'self-recovers when the %s write fails once after key activation',
    async (failurePoint) => {
      const sdk = await createZeroDevWalletCore(baseConfig())
      let failed = false
      adapter.setItem.mockImplementation((key: string, value: string) => {
        const shouldFail =
          (failurePoint === 'session record' &&
            key.includes('session_oauth_')) ||
          (failurePoint === 'session index' && key === '@zerodev/sessions') ||
          (failurePoint === 'active pointer' &&
            key === '@zerodev/active_session')
        if (!failed && shouldFail) {
          failed = true
          throw new Error(`transient ${failurePoint} failure`)
        }
        adapter.store.set(key, value)
      })

      await expect(
        sdk.auth({ type: 'oauth', provider: 'google', sessionId: 's' }),
      ).resolves.toMatchObject({ session: VALID_JWT })

      await expect(sdk.getSession()).resolves.toMatchObject({
        token: VALID_JWT,
        publicKey: 'rotated-pub-key',
      })
      expect(failed).toBe(true)
      expect(adapter.store.has('@zerodev/session_transition')).toBe(false)
    },
  )
})

// auth: passkey register
describe('auth — passkey register', () => {
  it('registers, rotates the key, and commits ONLY after the server accepts login', async () => {
    h.apiKeyStamper.prepareKeyRotation
      .mockResolvedValueOnce('registration-pub-key')
      .mockResolvedValueOnce('rotated-pub-key')
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
      encodedPublicKey: 'registration-pub-key',
    })
    // Login uses the rotated (pending) public key against the resolved org.
    expect(h.client.loginWithStamp).toHaveBeenCalledWith(
      expect.objectContaining({
        targetPublicKey: 'rotated-pub-key',
        projectId: 'proj-1',
        organizationId: 'org-explicit',
      }),
    )
    // The registration key is committed only after the backend creates it;
    // the durable key is committed only after login returns a matching JWT.
    expect(invocationOrder(h.client.registerWithPasskey)).toBeLessThan(
      invocationOrder(h.apiKeyStamper.commitKeyRotation),
    )
    expect(invocationOrder(h.apiKeyStamper.prepareKeyRotation, 1)).toBeLessThan(
      invocationOrder(h.client.loginWithStamp),
    )
    expect(invocationOrder(h.client.loginWithStamp)).toBeLessThan(
      invocationOrder(h.apiKeyStamper.commitKeyRotation, 1),
    )

    // Returns the registration response (not the login response).
    expect(data).toMatchObject({ userId: 'user-1', walletAddress: '0xwallet' })

    // Session expiration comes from the backend-signed JWT.
    const stored = await sdk.getSession()
    expect(stored).toMatchObject({
      id: `session_indexedDb_${BASE_TIME_MS}`,
      stamperType: 'apiKey',
      expiry: 2_000_000_000,
      token: VALID_JWT,
    })
  })

  it('throws when a public key cannot be generated', async () => {
    h.apiKeyStamper.prepareKeyRotation.mockRejectedValueOnce(
      new Error('Failed to get public key'),
    )
    const sdk = await createZeroDevWalletCore(baseConfig())

    await expect(
      sdk.auth({ type: 'passkey', mode: 'register' }),
    ).rejects.toThrow('Failed to get public key')
  })

  it('refuses passkey registration while another wallet session is active', async () => {
    const sdk = await createZeroDevWalletCore(baseConfig())
    await sdk.auth({ type: 'oauth', provider: 'google', sessionId: 'existing' })
    const existingSession = await sdk.getSession()

    h.apiKeyStamper.resetKeyPair.mockClear()
    await expect(
      sdk.auth({ type: 'passkey', mode: 'register' }),
    ).rejects.toThrow(/logout before registering/i)

    expect(await sdk.getSession()).toEqual(existingSession)
    expect(h.passkeyStamper.register).not.toHaveBeenCalled()
    expect(h.apiKeyStamper.resetKeyPair).not.toHaveBeenCalled()
  })
})

// auth: passkey login
describe('auth — passkey login', () => {
  it('logs in with the passkey stamper and commits the accepted pending key', async () => {
    const sdk = await createZeroDevWalletCore(baseConfig())

    const loginData = await sdk.auth({ type: 'passkey', mode: 'login' })

    expect(h.client.loginWithStamp).toHaveBeenCalledWith(
      expect.objectContaining({
        targetPublicKey: 'rotated-pub-key',
        stampWith: 'passkey',
        organizationId: 'org-explicit',
      }),
    )
    expect(h.apiKeyStamper.prepareKeyRotation).toHaveBeenCalledOnce()
    expect(h.apiKeyStamper.commitKeyRotation).toHaveBeenCalledOnce()
    expect(loginData).toEqual({ session: VALID_JWT })

    expect(await sdk.getSession()).toMatchObject({
      stamperType: 'apiKey',
      expiry: 2_000_000_000,
    })
  })

  it('preserves the live key and session when passkey login fails', async () => {
    const sdk = await createZeroDevWalletCore(baseConfig())
    await sdk.auth({ type: 'oauth', provider: 'google', sessionId: 'existing' })
    const existingSession = await sdk.getSession()

    h.apiKeyStamper.resetKeyPair.mockClear()
    h.client.loginWithStamp.mockRejectedValueOnce(new Error('login failed'))

    await expect(sdk.auth({ type: 'passkey', mode: 'login' })).rejects.toThrow(
      'login failed',
    )

    expect(await sdk.getSession()).toEqual(existingSession)
    expect(h.apiKeyStamper.resetKeyPair).not.toHaveBeenCalled()
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
      publicKey: 'rotated-pub-key',
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
        publicKey: 'rotated-pub-key',
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
    h.apiKeyStamper.prepareKeyRotation.mockRejectedValueOnce(
      new Error('Failed to get public key'),
    )
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

  it('preserves the live key and session when OTP verification fails', async () => {
    const sdk = await createZeroDevWalletCore(baseConfig())
    await sdk.auth({ type: 'oauth', provider: 'google', sessionId: 'existing' })
    const existingSession = await sdk.getSession()

    h.apiKeyStamper.resetKeyPair.mockClear()
    h.authProxyClient.verifyOtp.mockRejectedValueOnce(new Error('invalid otp'))

    await expect(
      sdk.auth({
        type: 'otp',
        mode: 'verifyOtp',
        otpId: 'otp-1',
        otpCode: 'wrong',
        otpEncryptionTargetBundle: 'bundle',
      }),
    ).rejects.toThrow('invalid otp')

    expect(await sdk.getSession()).toEqual(existingSession)
    expect(h.apiKeyStamper.resetKeyPair).not.toHaveBeenCalled()
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
    h.apiKeyStamper.prepareKeyRotation.mockClear()
    h.apiKeyStamper.commitKeyRotation.mockClear()
    h.client.loginWithStamp.mockClear()

    const refreshed = await sdk.refreshSession()

    expect(h.client.loginWithStamp).toHaveBeenCalledWith(
      expect.objectContaining({
        targetPublicKey: 'rotated-pub-key',
        stampWith: 'apiKey',
        organizationId: 'org-explicit',
      }),
    )
    expect(invocationOrder(h.apiKeyStamper.prepareKeyRotation)).toBeLessThan(
      invocationOrder(h.client.loginWithStamp),
    )
    expect(invocationOrder(h.client.loginWithStamp)).toBeLessThan(
      invocationOrder(h.apiKeyStamper.commitKeyRotation),
    )

    // Old session replaced by a fresh indexedDb session.
    expect(refreshed?.id).toBe(`session_indexedDb_${BASE_TIME_MS}`)
    expect(refreshed?.id).not.toBe(oldId)
    const all = await sdk.getAllSessions()
    expect(Object.keys(all)).toEqual([`session_indexedDb_${BASE_TIME_MS}`])
  })

  it('does not commit a refreshed key until the replacement session is valid', async () => {
    const sdk = await createZeroDevWalletCore(baseConfig())
    await sdk.auth({ type: 'oauth', provider: 'google', sessionId: 'existing' })
    const existingSession = await sdk.getSession()

    h.apiKeyStamper.commitKeyRotation.mockClear()
    h.client.loginWithStamp.mockResolvedValueOnce({ session: 'invalid' })

    await expect(sdk.refreshSession()).rejects.toThrow(/JWT|session/i)

    expect(await sdk.getSession()).toEqual(existingSession)
    expect(h.apiKeyStamper.commitKeyRotation).not.toHaveBeenCalled()
  })

  it('rejects a replacement session bound to a different public key', async () => {
    const sdk = await createZeroDevWalletCore(baseConfig())
    await sdk.auth({ type: 'oauth', provider: 'google', sessionId: 'existing' })
    const existingSession = await sdk.getSession()

    h.apiKeyStamper.commitKeyRotation.mockClear()
    h.client.loginWithStamp.mockResolvedValueOnce({
      session: createJwt({
        exp: 2_000_000_000,
        public_key: 'attacker-key',
        session_type: 'SESSION_TYPE_READ_WRITE',
        user_id: 'user-1',
        organization_id: 'org-1',
      }),
    })

    await expect(sdk.refreshSession()).rejects.toThrow(/public key/i)

    expect(await sdk.getSession()).toEqual(existingSession)
    expect(h.apiKeyStamper.commitKeyRotation).not.toHaveBeenCalled()
  })

  it('never overlaps refreshes that share the stamper pending-key slot', async () => {
    const sdk = await createZeroDevWalletCore(baseConfig())
    await sdk.auth({ type: 'oauth', provider: 'google', sessionId: 'existing' })

    let releaseFirst = () => {}
    const firstLoginGate = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })
    let calls = 0
    let inFlight = 0
    let maxInFlight = 0
    h.client.loginWithStamp.mockImplementation(async () => {
      calls += 1
      inFlight += 1
      maxInFlight = Math.max(maxInFlight, inFlight)
      if (calls === 1) await firstLoginGate
      inFlight -= 1
      return { session: VALID_JWT }
    })

    const first = sdk.refreshSession()
    const second = sdk.refreshSession()
    for (let i = 0; i < 100 && maxInFlight === 0; i += 1) {
      await Promise.resolve()
    }
    const observedMaxInFlight = maxInFlight

    releaseFirst()
    await Promise.allSettled([first, second])

    expect(observedMaxInFlight).toBe(1)
  })

  it('throws for a non-apiKey session type', async () => {
    // Seed a restored passkey-type session directly into storage. NOTE: no SDK
    // flow currently produces stamperType:'passkey' (passkey login/register both
    // store 'apiKey'), so this guard is unreachable via the public API today —
    // the test protects it as a regression guard for future/restored sessions.
    // It couples to the manager's private project-scoped storage keys; a rename
    // there would break this test without any change to core's own logic.
    const key = 'session:passkey'
    const passkeySession = {
      id: key,
      userId: 'user-1',
      organizationId: 'org-1',
      stamperType: 'passkey',
      token: VALID_JWT,
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

  it('refuses to refresh an inactive session after the key has changed', async () => {
    const sdk = await createZeroDevWalletCore(baseConfig())
    await sdk.auth({ type: 'oauth', provider: 'google', sessionId: 'a' })
    const targetId = await activeSessionId(sdk)
    vi.setSystemTime(BASE_TIME_MS + 1000)
    await sdk.auth({ type: 'oauth', provider: 'google', sessionId: 'b' })
    const activeId = await activeSessionId(sdk)

    h.apiKeyStamper.prepareKeyRotation.mockClear()
    await expect(sdk.refreshSession(targetId)).rejects.toThrow(
      /inactive session|not supported/i,
    )

    const all = await sdk.getAllSessions()
    expect(all[targetId]).toBeUndefined()
    expect(all[activeId]).toBeDefined()
    expect(h.apiKeyStamper.prepareKeyRotation).not.toHaveBeenCalled()
  })
})

// session management
describe('session management', () => {
  it('keeps an existing session bound to the active device key', async () => {
    const session = {
      id: 'existing-session',
      userId: 'user-1',
      organizationId: 'org-1',
      stamperType: 'apiKey' as const,
      sessionType: 'SESSION_TYPE_READ_WRITE' as const,
      token: VALID_JWT,
      expiry: 2_000_000_000,
      createdAt: BASE_TIME_MS,
    }
    adapter.store.set(session.id, JSON.stringify(session))
    adapter.store.set('@zerodev/sessions', JSON.stringify([session.id]))
    adapter.store.set('@zerodev/active_session', session.id)

    const sdk = await createZeroDevWalletCore(baseConfig())

    await expect(sdk.getSession()).resolves.toEqual(session)
  })

  it('clears a restored session whose JWT is bound to another key', async () => {
    const session = {
      id: 'tampered-session',
      userId: 'user-1',
      organizationId: 'org-1',
      stamperType: 'apiKey' as const,
      token: createJwt({
        exp: 2_000_000_000,
        public_key: 'attacker-public-key',
        session_type: 'SESSION_TYPE_READ_WRITE',
        user_id: 'user-1',
        organization_id: 'org-1',
      }),
      expiry: 2_000_000_000,
      createdAt: BASE_TIME_MS,
    }
    adapter.store.set(session.id, JSON.stringify(session))
    adapter.store.set('@zerodev/sessions', JSON.stringify([session.id]))
    adapter.store.set('@zerodev/active_session', session.id)

    const sdk = await createZeroDevWalletCore(baseConfig())

    await expect(sdk.getSession()).resolves.toBeUndefined()
    await expect(sdk.getAllSessions()).resolves.toEqual({})
    expect(adapter.store.has(session.id)).toBe(false)
  })

  it('switchSession returns the session when it is already active', async () => {
    const sdk = await createZeroDevWalletCore(baseConfig())
    await sdk.auth({ type: 'oauth', provider: 'google', sessionId: 'a' })
    const activeId = await activeSessionId(sdk)

    const switched = await sdk.switchSession(activeId)

    expect(switched?.id).toBe(activeId)
    expect((await sdk.getSession())?.id).toBe(activeId)
  })

  it('refuses session switching while the SDK has only one global key vault', async () => {
    const sdk = await createZeroDevWalletCore(baseConfig())
    await sdk.auth({ type: 'oauth', provider: 'google', sessionId: 'a' })
    const firstId = await activeSessionId(sdk)
    vi.setSystemTime(BASE_TIME_MS + 1000)
    await sdk.auth({ type: 'oauth', provider: 'google', sessionId: 'b' })

    await expect(sdk.switchSession(firstId)).rejects.toThrow(
      /single active session|not supported/i,
    )
  })

  it('clearSession removes only the named session', async () => {
    const sdk = await createZeroDevWalletCore(baseConfig())
    await sdk.auth({ type: 'oauth', provider: 'google', sessionId: 'a' })
    const firstId = await activeSessionId(sdk)
    vi.setSystemTime(BASE_TIME_MS + 1000)
    await sdk.auth({ type: 'oauth', provider: 'google', sessionId: 'b' })
    const secondId = await activeSessionId(sdk)

    await sdk.clearSession(firstId)

    const all = await sdk.getAllSessions()
    expect(all[firstId]).toBeUndefined()
    expect(all[secondId]).toBeDefined()
  })

  it('refuses to orphan the active remote key through local session clearing', async () => {
    const sdk = await createZeroDevWalletCore(baseConfig())
    await sdk.auth({ type: 'oauth', provider: 'google', sessionId: 'a' })
    const activeId = await activeSessionId(sdk)

    await expect(sdk.clearSession(activeId)).rejects.toThrow(/use logout/i)
    await expect(sdk.clearAllSessions()).rejects.toThrow(/use logout/i)

    await expect(sdk.getSession()).resolves.toBeDefined()
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
  it('revokes the exact current key before clearing local state', async () => {
    const sdk = await createZeroDevWalletCore(baseConfig())
    await sdk.auth({ type: 'oauth', provider: 'google', sessionId: 's' })
    h.apiKeyStamper.clear.mockClear()
    h.client.logout.mockImplementationOnce(async () => {
      expect(await sdk.getSession()).toBeDefined()
      expect(h.apiKeyStamper.clear).not.toHaveBeenCalled()
      return {}
    })

    const result = await sdk.logout()

    expect(result).toBe(true)
    expect(h.client.getAuthenticators).toHaveBeenCalledWith({
      subOrganizationId: 'org-1',
      projectId: 'proj-1',
      token: VALID_JWT,
    })
    expect(h.client.logout).toHaveBeenCalledWith({
      projectId: 'proj-1',
      organizationId: 'org-1',
      userId: 'user-1',
      apiKeyId: 'turnkey-session-key-1',
    })
    expect(h.apiKeyStamper.clear).toHaveBeenCalled()
    expect(await sdk.getSession()).toBeUndefined()
    expect(await sdk.getAllSessions()).toEqual({})
  })

  it('preserves the live local key and session when remote revocation fails', async () => {
    const sdk = await createZeroDevWalletCore(baseConfig())
    await sdk.auth({ type: 'oauth', provider: 'google', sessionId: 's' })
    h.apiKeyStamper.clear.mockClear()
    h.client.logout.mockRejectedValueOnce(new Error('activity rejected'))

    await expect(sdk.logout()).rejects.toThrow('activity rejected')

    expect(await sdk.getSession()).toBeDefined()
    expect(h.apiKeyStamper.clear).not.toHaveBeenCalled()
  })

  it('allows explicit local recovery after an ambiguous revocation failure', async () => {
    const sdk = await createZeroDevWalletCore(baseConfig())
    await sdk.auth({ type: 'oauth', provider: 'google', sessionId: 's' })
    h.apiKeyStamper.clear.mockClear()
    h.client.logout.mockRejectedValueOnce(new Error('network unavailable'))

    await expect(sdk.logout({ force: true })).resolves.toBe(true)

    expect(h.apiKeyStamper.clear).toHaveBeenCalledOnce()
    await expect(sdk.getSession()).resolves.toBeUndefined()
  })

  it('clears unusable session metadata when the local key is already gone', async () => {
    const sdk = await createZeroDevWalletCore(baseConfig())
    await sdk.auth({ type: 'oauth', provider: 'google', sessionId: 's' })
    h.apiKeyStamper.getPublicKey.mockResolvedValue(null)
    h.apiKeyStamper.clear.mockClear()
    h.client.getAuthenticators.mockClear()

    await expect(sdk.logout()).resolves.toBe(true)

    expect(h.client.getAuthenticators).not.toHaveBeenCalled()
    expect(h.apiKeyStamper.clear).toHaveBeenCalledOnce()
    await expect(sdk.getSession()).resolves.toBeUndefined()
  })

  it('clears local state when the backend confirms the credential is rejected', async () => {
    const sdk = await createZeroDevWalletCore(baseConfig())
    await sdk.auth({ type: 'oauth', provider: 'google', sessionId: 's' })
    h.apiKeyStamper.clear.mockClear()
    h.client.getAuthenticators.mockRejectedValueOnce(
      new RestRequestError('https://kms.test/authenticators', 401, {
        message: 'credential revoked',
      }),
    )

    await expect(sdk.logout()).resolves.toBe(true)

    expect(h.apiKeyStamper.clear).toHaveBeenCalledOnce()
    await expect(sdk.getSession()).resolves.toBeUndefined()
  })

  it('preserves local credentials on a non-terminal 403 revocation failure', async () => {
    const sdk = await createZeroDevWalletCore(baseConfig())
    await sdk.auth({ type: 'oauth', provider: 'google', sessionId: 's' })
    h.apiKeyStamper.clear.mockClear()
    h.client.getAuthenticators.mockRejectedValueOnce(
      new RestRequestError('https://kms.test/authenticators', 403, {
        message: 'policy denied',
      }),
    )

    await expect(sdk.logout()).rejects.toThrow()

    expect(h.apiKeyStamper.clear).not.toHaveBeenCalled()
    await expect(sdk.getSession()).resolves.toBeDefined()
  })

  it('matches equivalent Turnkey public-key encodings during logout', async () => {
    const sdk = await createZeroDevWalletCore(baseConfig())
    await sdk.auth({ type: 'oauth', provider: 'google', sessionId: 's' })
    const localPublicKey = `0x02${'AB'.repeat(32)}`
    h.apiKeyStamper.getPublicKey.mockResolvedValue(localPublicKey)
    h.client.getAuthenticators.mockResolvedValueOnce({
      oauths: null,
      passkeys: null,
      emailContacts: null,
      apiKeys: null,
      sessionKeys: [
        {
          ApiKey: localPublicKey.slice(2).toLowerCase(),
          TurnkeyId: 'normalized-key-id',
        },
      ],
    })

    await sdk.logout()

    expect(h.client.logout).toHaveBeenCalledWith(
      expect.objectContaining({ apiKeyId: 'normalized-key-id' }),
    )
  })

  it('accepts the legacy lowercase authenticator response casing', async () => {
    const sdk = await createZeroDevWalletCore(baseConfig())
    await sdk.auth({ type: 'oauth', provider: 'google', sessionId: 's' })
    h.client.getAuthenticators.mockResolvedValueOnce({
      oauths: null,
      passkeys: null,
      emailContacts: null,
      apiKeys: null,
      sessionKeys: [
        {
          apiKey: 'rotated-pub-key',
          turnkeyId: 'legacy-lowercase-key-id',
        },
      ],
    })

    await sdk.logout()

    expect(h.client.logout).toHaveBeenCalledWith(
      expect.objectContaining({ apiKeyId: 'legacy-lowercase-key-id' }),
    )
  })

  it('does not reuse a prepared OAuth key after logout', async () => {
    const sdk = await createZeroDevWalletCore(baseConfig())
    await sdk.auth({ type: 'oauth', provider: 'google', sessionId: 's' })
    h.apiKeyStamper.prepareKeyRotation.mockClear()

    await sdk.getPublicKey()
    await sdk.logout()
    await sdk.getPublicKey()

    expect(h.apiKeyStamper.prepareKeyRotation).toHaveBeenCalledTimes(2)
  })

  it('still removes session tokens when local key cleanup throws', async () => {
    const sdk = await createZeroDevWalletCore(baseConfig())
    await sdk.auth({ type: 'oauth', provider: 'google', sessionId: 's' })
    h.apiKeyStamper.clear.mockRejectedValueOnce(new Error('key erase failed'))

    await expect(sdk.logout()).rejects.toThrow('key erase failed')

    await expect(sdk.getSession()).resolves.toBeUndefined()
  })

  it('preserves local state if the backend cannot identify the current key', async () => {
    const sdk = await createZeroDevWalletCore(baseConfig())
    await sdk.auth({ type: 'oauth', provider: 'google', sessionId: 's' })
    h.apiKeyStamper.clear.mockClear()
    h.client.getAuthenticators.mockResolvedValueOnce({
      oauths: null,
      passkeys: null,
      emailContacts: null,
      apiKeys: null,
      sessionKeys: [],
    })

    await expect(sdk.logout()).rejects.toThrow(/refusing to erase local/i)

    expect(h.client.logout).not.toHaveBeenCalled()
    expect(await sdk.getSession()).toBeDefined()
    expect(h.apiKeyStamper.clear).not.toHaveBeenCalled()
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
    const toAccountCall = h.toViemAccount.mock.calls[0]
    if (!toAccountCall) throw new Error('Expected toViemAccount call')
    const { getToken } = toAccountCall[0] as {
      getToken: () => Promise<string>
    }
    expect(await getToken()).toBe(VALID_JWT)
  })
})
