import type { Config, Connector } from '@wagmi/core'
import { connect as wagmiConnect } from '@wagmi/core/actions'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { authenticateOAuth } from './authenticateOAuth.js'

vi.mock('@wagmi/core/actions', () => ({
  connect: vi.fn().mockResolvedValue({}),
}))

// Mocked so tests don't run real URL verification — they only need to assert
// that the URL returned by `wallet.client.getOAuthLoginUrl` is verified before
// it reaches the adapter. The verification itself is covered in
// `utils/verifyGoogleLoginUrl.test.ts`.
vi.mock('./utils/verifyGoogleLoginUrl.js', () => ({
  verifyGoogleLoginUrl: vi.fn(),
  OAUTH_PROVIDERS: { GOOGLE: 'google' },
}))

const MOCK_OAUTH_URL =
  'https://accounts.google.com/o/oauth2/v2/auth?nonce=abc123&client_id=x'

function createMockWallet() {
  return {
    auth: vi.fn().mockResolvedValue({}),
    getSession: vi
      .fn()
      .mockResolvedValue({ id: 'session-123', expiry: 9999999999 }),
    toAccount: vi.fn().mockResolvedValue({ address: '0x1234abcd' }),
    getPublicKey: vi.fn().mockResolvedValue('03abcdef123'),
    client: {
      getOAuthLoginUrl: vi.fn().mockResolvedValue(MOCK_OAUTH_URL),
    },
  }
}

function createMockStore(
  wallet: ReturnType<typeof createMockWallet> | null = createMockWallet(),
  oauthConfig: { backendUrl: string; projectId: string } | null = {
    backendUrl: 'https://api.example.com',
    projectId: 'proj-123',
  },
) {
  const state = {
    wallet,
    oauthConfig,
    setEoaAccount: vi.fn(),
    setSession: vi.fn(),
  }
  return {
    getState: vi.fn().mockReturnValue(state),
  }
}

function createMockConnector(store = createMockStore()) {
  return {
    id: 'zerodev-wallet',
    getStore: vi.fn().mockResolvedValue(store),
  } as unknown as Connector
}

function createMockConfig(connector = createMockConnector()) {
  return {
    connectors: [connector],
    chains: [],
    state: { chainId: 1, connections: new Map() },
    storage: null,
  } as unknown as Config
}

// Default call harness: injects a trivial mock adapter so tests focused on
// orchestration/validation don't depend on the web fallback path. Tests that
// specifically care about adapter behavior call authenticateOAuth directly.
function callAuth(
  config: Config,
  overrides: Partial<authenticateOAuth.Parameters> = {},
) {
  return authenticateOAuth(config, {
    provider: 'google',
    getSessionId: async () => 'mock-sid',
    redirectUri: 'https://app.example.com/oauth-callback',
    ...overrides,
  })
}

describe('authenticateOAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // @ts-expect-error - Mocking location
    window.location = { origin: 'https://app.example.com' } as Location
  })

  it('throws when wallet is not initialized', async () => {
    const store = createMockStore(null)
    const connector = createMockConnector(store)
    const config = createMockConfig(connector)

    await expect(callAuth(config)).rejects.toThrow('Wallet not initialized')
  })

  it('throws when oauthConfig is missing', async () => {
    const wallet = createMockWallet()
    const store = createMockStore(wallet, null)
    const connector = createMockConnector(store)
    const config = createMockConfig(connector)

    await expect(callAuth(config)).rejects.toThrow(
      'Wallet not initialized. Please wait for connector setup.',
    )
  })

  it('throws when publicKey is null', async () => {
    const wallet = createMockWallet()
    wallet.getPublicKey.mockResolvedValue(null)
    const store = createMockStore(wallet)
    const connector = createMockConnector(store)
    const config = createMockConfig(connector)

    await expect(callAuth(config)).rejects.toThrow(
      'Failed to get wallet public key',
    )
  })

  it('uses consumer adapter when getSessionId + redirectUri are provided', async () => {
    const wallet = createMockWallet()
    wallet.getSession.mockResolvedValue({ id: 'oauth-session' })
    wallet.toAccount.mockResolvedValue({ address: '0xoauth' })
    const store = createMockStore(wallet)
    const connector = createMockConnector(store)
    const config = createMockConfig(connector)

    const getSessionId = vi.fn().mockResolvedValue('adapter-session-id')

    await authenticateOAuth(config, {
      provider: 'google',
      redirectUri: 'https://app.com/cb',
      getSessionId,
    })

    expect(wallet.client.getOAuthLoginUrl).toHaveBeenCalledWith({
      provider: 'google',
      projectId: 'proj-123',
      publicKey: '03abcdef123',
      returnTo: expect.stringContaining('https://app.com/cb'),
    })
    expect(getSessionId).toHaveBeenCalledWith({
      oauthUrl: MOCK_OAUTH_URL,
      provider: 'google',
    })
    expect(wallet.auth).toHaveBeenCalledWith({
      type: 'oauth',
      provider: 'google',
      sessionId: 'adapter-session-id',
    })
    expect(store.getState().setEoaAccount).toHaveBeenCalledWith({
      address: '0xoauth',
    })
    expect(store.getState().setSession).toHaveBeenCalledWith({
      id: 'oauth-session',
    })
    expect(wagmiConnect).toHaveBeenCalledWith(config, { connector })
  })

  it('constructs returnTo from redirectUri on adapter path', async () => {
    const wallet = createMockWallet()
    const store = createMockStore(wallet)
    const connector = createMockConnector(store)
    const config = createMockConfig(connector)

    const getSessionId = vi.fn().mockResolvedValue('sid')
    await authenticateOAuth(config, {
      provider: 'google',
      redirectUri: 'zerodev://oauth',
      getSessionId,
    })

    const returnTo: string =
      wallet.client.getOAuthLoginUrl.mock.calls[0][0].returnTo
    expect(returnTo).toBe(
      'zerodev://oauth?oauth_success=true&oauth_provider=google',
    )
  })

  it('preserves caller pathname/query and drops hash from returnTo', async () => {
    const wallet = createMockWallet()
    const store = createMockStore(wallet)
    const connector = createMockConnector(store)
    const config = createMockConfig(connector)

    const getSessionId = vi.fn().mockResolvedValue('sid')
    await authenticateOAuth(config, {
      provider: 'google',
      redirectUri: 'https://app.example.com/dashboard?utm=src#section',
      getSessionId,
    })

    const returnTo: string =
      wallet.client.getOAuthLoginUrl.mock.calls[0][0].returnTo
    const parsed = new URL(returnTo)
    expect(parsed.origin).toBe('https://app.example.com')
    expect(parsed.pathname).toBe('/dashboard')
    expect(parsed.searchParams.get('utm')).toBe('src')
    expect(parsed.searchParams.get('oauth_success')).toBe('true')
    expect(parsed.searchParams.get('oauth_provider')).toBe('google')
    expect(parsed.hash).toBe('')
  })

  // This also transitively guarantees the web hook's popup is NOT opened on
  // verification failure: the web hook's `getSessionId` IS `getSessionIdWeb`,
  // and this test asserts the adapter is never invoked when verification throws.
  it('verifies the URL before invoking the adapter', async () => {
    const { verifyGoogleLoginUrl } = await import(
      './utils/verifyGoogleLoginUrl.js'
    )
    vi.mocked(verifyGoogleLoginUrl).mockImplementationOnce(() => {
      throw new Error('login URL nonce does not match public key hash')
    })

    const wallet = createMockWallet()
    const store = createMockStore(wallet)
    const connector = createMockConnector(store)
    const config = createMockConfig(connector)

    const getSessionId = vi.fn().mockResolvedValue('should-not-reach')

    await expect(
      authenticateOAuth(config, {
        provider: 'google',
        redirectUri: 'zerodev://oauth',
        getSessionId,
      }),
    ).rejects.toThrow(/nonce does not match public key hash/)

    expect(verifyGoogleLoginUrl).toHaveBeenCalledWith(
      MOCK_OAUTH_URL,
      '03abcdef123',
    )
    expect(getSessionId).not.toHaveBeenCalled()
    expect(wallet.auth).not.toHaveBeenCalled()
  })

  it('propagates adapter rejection', async () => {
    const wallet = createMockWallet()
    const store = createMockStore(wallet)
    const connector = createMockConnector(store)
    const config = createMockConfig(connector)

    await expect(
      authenticateOAuth(config, {
        provider: 'google',
        redirectUri: 'zerodev://oauth',
        getSessionId: async () => {
          throw new Error('OAuth cancelled or failed')
        },
      }),
    ).rejects.toThrow('OAuth cancelled or failed')
  })

  it('propagates wallet.auth rejection', async () => {
    const wallet = createMockWallet()
    wallet.auth.mockRejectedValue(new Error('Auth backend error'))
    const store = createMockStore(wallet)
    const connector = createMockConnector(store)
    const config = createMockConfig(connector)

    await expect(callAuth(config)).rejects.toThrow('Auth backend error')
  })
})
