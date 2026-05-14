import type { Config, Connector } from '@wagmi/core'
import { connect as wagmiConnect } from '@wagmi/core/actions'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { authenticateOAuth } from './authenticateOAuth.js'

vi.mock('@wagmi/core/actions', () => ({
  connect: vi.fn().mockResolvedValue({}),
}))

// Mocked so tests in the "web default fallback" describe block below can
// assert on how authenticateOAuth dispatches to it. Tests outside that block
// use an explicit adapter and never reach the web fallback path.
vi.mock('./getSessionIdWeb.js', () => ({
  getSessionIdWeb: vi.fn(),
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
  overrides: Partial<
    authenticateOAuth.Parameters & authenticateOAuth.AdapterOptions
  > = {},
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

  it('throws when only redirectUri is provided', async () => {
    const wallet = createMockWallet()
    const store = createMockStore(wallet)
    const connector = createMockConnector(store)
    const config = createMockConfig(connector)

    await expect(
      authenticateOAuth(config, {
        provider: 'google',
        redirectUri: 'zerodev://oauth',
      }),
    ).rejects.toThrow('redirectUri and getSessionId must be provided together')
  })

  it('throws when only getSessionId is provided', async () => {
    const wallet = createMockWallet()
    const store = createMockStore(wallet)
    const connector = createMockConnector(store)
    const config = createMockConfig(connector)

    await expect(
      authenticateOAuth(config, {
        provider: 'google',
        getSessionId: async () => 'session-id',
      }),
    ).rejects.toThrow('redirectUri and getSessionId must be provided together')
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

/**
 * Tests below cover authenticateOAuth's web default fallback (calling
 * getSessionIdWeb when no adapter is provided). Delete this block when
 * getSessionIdWeb is extracted to @zerodev/wallet-react-kit and the fallback
 * is removed from authenticateOAuth.
 */
describe('authenticateOAuth — web default fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // @ts-expect-error - Mocking location
    window.location = {
      origin: 'https://app.example.com',
      href: 'https://app.example.com/',
    } as Location
  })

  it('uses getSessionIdWeb when no adapter is provided', async () => {
    const { getSessionIdWeb } = await import('./getSessionIdWeb.js')
    vi.mocked(getSessionIdWeb).mockResolvedValue('web-session-id')

    const wallet = createMockWallet()
    const store = createMockStore(wallet)
    const connector = createMockConnector(store)
    const config = createMockConfig(connector)

    await authenticateOAuth(config, { provider: 'google' })

    expect(getSessionIdWeb).toHaveBeenCalledWith(
      MOCK_OAUTH_URL,
      'https://app.example.com',
      undefined,
    )
    expect(wallet.auth).toHaveBeenCalledWith({
      type: 'oauth',
      provider: 'google',
      sessionId: 'web-session-id',
    })
  })

  it('constructs returnTo from window.location.href on default path', async () => {
    const { getSessionIdWeb } = await import('./getSessionIdWeb.js')
    vi.mocked(getSessionIdWeb).mockResolvedValue('sid')

    const wallet = createMockWallet()
    const store = createMockStore(wallet)
    const connector = createMockConnector(store)
    const config = createMockConfig(connector)

    await authenticateOAuth(config, { provider: 'google' })

    const returnTo: string =
      wallet.client.getOAuthLoginUrl.mock.calls[0][0].returnTo
    expect(returnTo).toBe(
      'https://app.example.com/?oauth_success=true&oauth_provider=google',
    )
  })

  it('preserves caller pathname/query and drops hash from returnTo on default path', async () => {
    const { getSessionIdWeb } = await import('./getSessionIdWeb.js')
    vi.mocked(getSessionIdWeb).mockResolvedValue('sid')

    // @ts-expect-error - Mocking location
    window.location = {
      origin: 'https://app.example.com',
      href: 'https://app.example.com/dashboard?utm=src#section',
    } as Location

    const wallet = createMockWallet()
    const store = createMockStore(wallet)
    const connector = createMockConnector(store)
    const config = createMockConfig(connector)

    await authenticateOAuth(config, { provider: 'google' })

    const returnTo: string =
      wallet.client.getOAuthLoginUrl.mock.calls[0][0].returnTo
    const parsed = new URL(returnTo)
    expect(parsed.pathname).toBe('/dashboard')
    expect(parsed.searchParams.get('oauth_success')).toBe('true')
    expect(parsed.searchParams.get('oauth_provider')).toBe('google')
    expect(parsed.searchParams.get('utm')).toBe('src')
    expect(parsed.hash).toBe('')
  })

  it('passes timeoutMs to getSessionIdWeb on default path', async () => {
    const { getSessionIdWeb } = await import('./getSessionIdWeb.js')
    vi.mocked(getSessionIdWeb).mockResolvedValue('sid')

    const wallet = createMockWallet()
    const store = createMockStore(wallet)
    const connector = createMockConnector(store)
    const config = createMockConfig(connector)

    await authenticateOAuth(config, {
      provider: 'google',
      timeoutMs: 30_000,
    })

    expect(getSessionIdWeb).toHaveBeenCalledWith(
      MOCK_OAUTH_URL,
      'https://app.example.com',
      30_000,
    )
  })

  it('does NOT open popup when nonce verification fails', async () => {
    const { getSessionIdWeb } = await import('./getSessionIdWeb.js')
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

    await expect(
      authenticateOAuth(config, { provider: 'google' }),
    ).rejects.toThrow(/nonce does not match public key hash/)

    expect(getSessionIdWeb).not.toHaveBeenCalled()
    expect(wallet.auth).not.toHaveBeenCalled()
  })
})
