import type { Config, Connector } from '@wagmi/core'
import { connect as wagmiConnect } from '@wagmi/core/actions'
import {
  createIframeStamper,
  exportPrivateKey as exportPrivateKeySdk,
  exportWallet as exportWalletSdk,
} from '@zerodev/wallet-core'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  authenticateOAuth,
  exportPrivateKey,
  exportWallet,
  getUserEmail,
  loginPasskey,
  refreshSession,
  registerPasskey,
  sendOTP,
  verifyOTP,
} from './actions.js'

// Mock wagmi connect
vi.mock('@wagmi/core/actions', () => ({
  connect: vi.fn().mockResolvedValue({}),
}))

// Mock OAuth utilities
vi.mock('./oauth.js', () => ({
  buildBackendOAuthUrl: vi.fn().mockReturnValue('https://oauth.example.com'),
  openOAuthPopup: vi.fn(),
  listenForOAuthMessage: vi.fn(),
}))

// Mock core SDK
vi.mock('@zerodev/wallet-core', () => ({
  createIframeStamper: vi.fn(),
  exportPrivateKey: vi.fn(),
  exportWallet: vi.fn(),
}))

// Create a mock wallet instance
function createMockWallet() {
  return {
    auth: vi.fn().mockResolvedValue({ otpId: 'otp-123' }),
    getSession: vi
      .fn()
      .mockResolvedValue({ id: 'session-123', expiry: 9999999999 }),
    toAccount: vi.fn().mockResolvedValue({ address: '0x1234abcd' }),
    getPublicKey: vi.fn().mockResolvedValue('03abcdef123'),
    refreshSession: vi.fn().mockResolvedValue({ id: 'new-session-456' }),
    client: {
      getUserEmail: vi.fn().mockResolvedValue({ email: 'user@example.com' }),
    },
  }
}

// Create a mock store
function createMockStore(
  wallet: ReturnType<typeof createMockWallet> | null = createMockWallet(),
  session: { id: string } | null = null,
  oauthConfig: { backendUrl: string; projectId: string } | null = {
    backendUrl: 'https://api.example.com',
    projectId: 'proj-123',
  },
) {
  const state = {
    wallet,
    session,
    oauthConfig,
    setEoaAccount: vi.fn(),
    setSession: vi.fn(),
  }
  return {
    getState: vi.fn().mockReturnValue(state),
    subscribe: vi.fn(),
    setState: vi.fn(),
  }
}

// Create a mock connector
function createMockConnector(store = createMockStore()) {
  return {
    id: 'zerodev-wallet',
    name: 'ZeroDev Wallet',
    type: 'zerodev-wallet',
    getStore: vi.fn().mockResolvedValue(store),
  } as unknown as Connector
}

// Create a mock config
function createMockConfig(connector = createMockConnector()) {
  return {
    connectors: [connector],
    chains: [],
    state: { chainId: 1, connections: new Map() },
    storage: null,
  } as unknown as Config
}

describe('React Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('registerPasskey', () => {
    it('calls wallet.auth with passkey register mode', async () => {
      const wallet = createMockWallet()
      const store = createMockStore(wallet)
      const connector = createMockConnector(store)
      const config = createMockConfig(connector)

      await registerPasskey(config, {})

      expect(wallet.auth).toHaveBeenCalledWith({
        type: 'passkey',
        mode: 'register',
      })
    })

    it('sets session and account with correct values after registration', async () => {
      const wallet = createMockWallet()
      wallet.getSession.mockResolvedValue({ id: 'sess-abc', expiry: 999 })
      wallet.toAccount.mockResolvedValue({ address: '0xdeadbeef' })
      const store = createMockStore(wallet)
      const connector = createMockConnector(store)
      const config = createMockConfig(connector)

      await registerPasskey(config, {})

      expect(store.getState().setEoaAccount).toHaveBeenCalledWith({
        address: '0xdeadbeef',
      })
      expect(store.getState().setSession).toHaveBeenCalledWith({
        id: 'sess-abc',
        expiry: 999,
      })
    })

    it('sets session to null when getSession returns falsy', async () => {
      const wallet = createMockWallet()
      wallet.getSession.mockResolvedValue(null)
      const store = createMockStore(wallet)
      const connector = createMockConnector(store)
      const config = createMockConfig(connector)

      await registerPasskey(config, {})

      expect(store.getState().setSession).toHaveBeenCalledWith(null)
    })

    it('calls wagmiConnect after registration', async () => {
      const wallet = createMockWallet()
      const store = createMockStore(wallet)
      const connector = createMockConnector(store)
      const config = createMockConfig(connector)

      await registerPasskey(config, {})

      expect(wagmiConnect).toHaveBeenCalledWith(config, { connector })
    })

    it('throws when wallet is not initialized', async () => {
      const store = createMockStore(null)
      const connector = createMockConnector(store)
      const config = createMockConfig(connector)

      await expect(registerPasskey(config, {})).rejects.toThrow(
        'Wallet not initialized',
      )
    })

    it('uses provided connector instead of finding one', async () => {
      const wallet = createMockWallet()
      const store = createMockStore(wallet)
      const customConnector = createMockConnector(store)
      const config = createMockConfig()

      await registerPasskey(config, {
        connector: customConnector,
      })

      expect(customConnector.getStore).toHaveBeenCalled()
    })
  })

  describe('loginPasskey', () => {
    it('calls wallet.auth with passkey login mode', async () => {
      const wallet = createMockWallet()
      const store = createMockStore(wallet)
      const connector = createMockConnector(store)
      const config = createMockConfig(connector)

      await loginPasskey(config, {})

      expect(wallet.auth).toHaveBeenCalledWith({
        type: 'passkey',
        mode: 'login',
      })
    })

    it('sets session and account with correct values after login', async () => {
      const wallet = createMockWallet()
      wallet.getSession.mockResolvedValue({ id: 'login-sess' })
      wallet.toAccount.mockResolvedValue({ address: '0xabc' })
      const store = createMockStore(wallet)
      const connector = createMockConnector(store)
      const config = createMockConfig(connector)

      await loginPasskey(config, {})

      expect(store.getState().setEoaAccount).toHaveBeenCalledWith({
        address: '0xabc',
      })
      expect(store.getState().setSession).toHaveBeenCalledWith({
        id: 'login-sess',
      })
    })

    it('calls wagmiConnect after login', async () => {
      const wallet = createMockWallet()
      const store = createMockStore(wallet)
      const connector = createMockConnector(store)
      const config = createMockConfig(connector)

      await loginPasskey(config, {})

      expect(wagmiConnect).toHaveBeenCalledWith(config, { connector })
    })

    it('throws when wallet is not initialized', async () => {
      const store = createMockStore(null)
      const connector = createMockConnector(store)
      const config = createMockConfig(connector)

      await expect(loginPasskey(config, {})).rejects.toThrow(
        'Wallet not initialized',
      )
    })
  })

  describe('sendOTP', () => {
    it('calls wallet.auth with otp sendOtp mode', async () => {
      const wallet = createMockWallet()
      const store = createMockStore(wallet)
      const connector = createMockConnector(store)
      const config = createMockConfig(connector)

      await sendOTP(config, { email: 'user@example.com' })

      expect(wallet.auth).toHaveBeenCalledWith({
        type: 'otp',
        mode: 'sendOtp',
        email: 'user@example.com',
        contact: { type: 'email', contact: 'user@example.com' },
      })
    })

    it('does not include emailCustomization when not provided', async () => {
      const wallet = createMockWallet()
      const store = createMockStore(wallet)
      const connector = createMockConnector(store)
      const config = createMockConfig(connector)

      await sendOTP(config, { email: 'user@example.com' })

      const authCall = wallet.auth.mock.calls[0][0]
      expect(authCall).not.toHaveProperty('emailCustomization')
    })

    it('returns otpId from wallet auth', async () => {
      const wallet = createMockWallet()
      wallet.auth.mockResolvedValue({ otpId: 'otp-456' })
      const store = createMockStore(wallet)
      const connector = createMockConnector(store)
      const config = createMockConfig(connector)

      const result = await sendOTP(config, { email: 'user@example.com' })

      expect(result).toEqual({ otpId: 'otp-456' })
    })

    it('includes email customization when provided', async () => {
      const wallet = createMockWallet()
      const store = createMockStore(wallet)
      const connector = createMockConnector(store)
      const config = createMockConfig(connector)

      await sendOTP(config, {
        email: 'user@example.com',
        emailCustomization: { magicLinkTemplate: 'https://app.com/verify/%s' },
      })

      expect(wallet.auth).toHaveBeenCalledWith({
        type: 'otp',
        mode: 'sendOtp',
        email: 'user@example.com',
        contact: { type: 'email', contact: 'user@example.com' },
        emailCustomization: {
          magicLinkTemplate: 'https://app.com/verify/%s',
        },
      })
    })

    it('throws when wallet is not initialized', async () => {
      const store = createMockStore(null)
      const connector = createMockConnector(store)
      const config = createMockConfig(connector)

      await expect(
        sendOTP(config, { email: 'user@example.com' }),
      ).rejects.toThrow('Wallet not initialized')
    })
  })

  describe('verifyOTP', () => {
    it('calls wallet.auth with otp verifyOtp mode', async () => {
      const wallet = createMockWallet()
      const store = createMockStore(wallet)
      const connector = createMockConnector(store)
      const config = createMockConfig(connector)

      await verifyOTP(config, { code: '123456', otpId: 'otp-123' })

      expect(wallet.auth).toHaveBeenCalledWith({
        type: 'otp',
        mode: 'verifyOtp',
        otpId: 'otp-123',
        otpCode: '123456',
      })
    })

    it('sets session and account with correct values after verification', async () => {
      const wallet = createMockWallet()
      wallet.getSession.mockResolvedValue({ id: 'verify-sess' })
      wallet.toAccount.mockResolvedValue({ address: '0xverified' })
      const store = createMockStore(wallet)
      const connector = createMockConnector(store)
      const config = createMockConfig(connector)

      await verifyOTP(config, { code: '123456', otpId: 'otp-123' })

      expect(store.getState().setEoaAccount).toHaveBeenCalledWith({
        address: '0xverified',
      })
      expect(store.getState().setSession).toHaveBeenCalledWith({
        id: 'verify-sess',
      })
    })

    it('calls wagmiConnect after verification', async () => {
      const wallet = createMockWallet()
      const store = createMockStore(wallet)
      const connector = createMockConnector(store)
      const config = createMockConfig(connector)

      await verifyOTP(config, { code: '123456', otpId: 'otp-123' })

      expect(wagmiConnect).toHaveBeenCalledWith(config, { connector })
    })

    it('throws when wallet is not initialized', async () => {
      const store = createMockStore(null)
      const connector = createMockConnector(store)
      const config = createMockConfig(connector)

      await expect(
        verifyOTP(config, { code: '123456', otpId: 'otp-123' }),
      ).rejects.toThrow('Wallet not initialized')
    })
  })

  describe('refreshSession', () => {
    it('calls wallet.refreshSession with current session id', async () => {
      const wallet = createMockWallet()
      const currentSession = { id: 'current-session-123' }
      const store = createMockStore(wallet, currentSession)
      const connector = createMockConnector(store)
      const config = createMockConfig(connector)

      await refreshSession(config)

      expect(wallet.refreshSession).toHaveBeenCalledWith('current-session-123')
    })

    it('updates session in store with new session and returns it', async () => {
      const wallet = createMockWallet()
      wallet.refreshSession.mockResolvedValue({ id: 'new-session-456' })
      const currentSession = { id: 'current-session-123' }
      const store = createMockStore(wallet, currentSession)
      const connector = createMockConnector(store)
      const config = createMockConfig(connector)

      const result = await refreshSession(config)

      expect(store.getState().setSession).toHaveBeenCalledWith({
        id: 'new-session-456',
      })
      expect(result).toEqual({ id: 'new-session-456' })
    })

    it('sets session to null when refresh returns falsy', async () => {
      const wallet = createMockWallet()
      wallet.refreshSession.mockResolvedValue(null)
      const currentSession = { id: 'current-session-123' }
      const store = createMockStore(wallet, currentSession)
      const connector = createMockConnector(store)
      const config = createMockConfig(connector)

      await refreshSession(config)

      expect(store.getState().setSession).toHaveBeenCalledWith(null)
    })

    it('throws when no active session', async () => {
      const wallet = createMockWallet()
      const store = createMockStore(wallet, null)
      const connector = createMockConnector(store)
      const config = createMockConfig(connector)

      await expect(refreshSession(config)).rejects.toThrow(
        'No active session to refresh',
      )
    })

    it('throws when wallet is not initialized', async () => {
      const store = createMockStore(null)
      const connector = createMockConnector(store)
      const config = createMockConfig(connector)

      await expect(refreshSession(config)).rejects.toThrow(
        'No active session to refresh',
      )
    })
  })

  describe('getUserEmail', () => {
    it('calls wallet.client.getUserEmail with parameters', async () => {
      const wallet = createMockWallet()
      const session = {
        id: 'session-123',
        organizationId: 'org-123',
        token: 'test-token',
      }
      const store = createMockStore(wallet, session)
      const connector = createMockConnector(store)
      const config = createMockConfig(connector)

      await getUserEmail(config)

      expect(wallet.client.getUserEmail).toHaveBeenCalledWith({
        organizationId: 'org-123',
        projectId: 'proj-123',
        token: 'test-token',
      })
    })

    it('returns email from wallet client', async () => {
      const wallet = createMockWallet()
      wallet.client.getUserEmail.mockResolvedValue({ email: 'test@test.com' })
      const session = {
        id: 'session-123',
        organizationId: 'org-123',
        token: 'test-token',
      }
      const store = createMockStore(wallet, session)
      const connector = createMockConnector(store)
      const config = createMockConfig(connector)

      const result = await getUserEmail(config)

      expect(result).toEqual({ email: 'test@test.com' })
    })

    it('throws when wallet is not initialized', async () => {
      const store = createMockStore(null)
      const connector = createMockConnector(store)
      const config = createMockConfig(connector)

      await expect(
        getUserEmail(config, {
          organizationId: 'org-123',
          projectId: 'proj-456',
        }),
      ).rejects.toThrow('Wallet not initialized')
    })
  })

  describe('authenticateOAuth', () => {
    let mockOpenOAuthPopup: ReturnType<typeof vi.fn>
    let mockListenForOAuthMessage: ReturnType<typeof vi.fn>
    let mockBuildBackendOAuthUrl: ReturnType<typeof vi.fn>

    beforeEach(async () => {
      const oauthModule = await import('./oauth.js')
      mockOpenOAuthPopup = vi.mocked(oauthModule.openOAuthPopup)
      mockListenForOAuthMessage = vi.mocked(oauthModule.listenForOAuthMessage)
      mockBuildBackendOAuthUrl = vi.mocked(oauthModule.buildBackendOAuthUrl)
    })

    it('throws when wallet is not initialized', async () => {
      const store = createMockStore(null)
      const connector = createMockConnector(store)
      const config = createMockConfig(connector)

      await expect(
        authenticateOAuth(config, { provider: 'google' }),
      ).rejects.toThrow('Wallet not initialized')
    })

    it('throws when oauthConfig is missing', async () => {
      const wallet = createMockWallet()
      const store = createMockStore(wallet, null, null)
      const connector = createMockConnector(store)
      const config = createMockConfig(connector)

      await expect(
        authenticateOAuth(config, { provider: 'google' }),
      ).rejects.toThrow(
        'Wallet not initialized. Please wait for connector setup.',
      )
    })

    it('throws when publicKey is null', async () => {
      const wallet = createMockWallet()
      wallet.getPublicKey.mockResolvedValue(null)
      const store = createMockStore(wallet)
      const connector = createMockConnector(store)
      const config = createMockConfig(connector)

      await expect(
        authenticateOAuth(config, { provider: 'google' }),
      ).rejects.toThrow('Failed to get wallet public key')
    })

    it('throws when popup is blocked', async () => {
      const wallet = createMockWallet()
      const store = createMockStore(wallet)
      const connector = createMockConnector(store)
      const config = createMockConfig(connector)

      mockOpenOAuthPopup.mockReturnValue(null)

      await expect(
        authenticateOAuth(config, { provider: 'google' }),
      ).rejects.toThrow('Failed to open google login window')
    })

    it('builds OAuth URL with correct parameters', async () => {
      const wallet = createMockWallet()
      wallet.getPublicKey.mockResolvedValue('03abcdef123456')
      const store = createMockStore(wallet)
      const connector = createMockConnector(store)
      const config = createMockConfig(connector)

      mockOpenOAuthPopup.mockReturnValue({ closed: false } as Window)
      mockListenForOAuthMessage.mockImplementation(() => {
        return () => {}
      })

      authenticateOAuth(config, { provider: 'google' }).catch(() => {})

      await new Promise((r) => setTimeout(r, 10))

      expect(mockBuildBackendOAuthUrl).toHaveBeenCalledWith({
        provider: 'google',
        backendUrl: 'https://api.example.com',
        projectId: 'proj-123',
        publicKey: '03abcdef123456',
        returnTo: expect.stringContaining('oauth_success=true'),
      })
    })

    it('completes full OAuth success flow', async () => {
      const wallet = createMockWallet()
      wallet.getSession.mockResolvedValue({ id: 'oauth-session' })
      wallet.toAccount.mockResolvedValue({ address: '0xoauth' })
      const store = createMockStore(wallet)
      const connector = createMockConnector(store)
      const config = createMockConfig(connector)

      mockOpenOAuthPopup.mockReturnValue({ closed: false } as Window)
      // Simulate the success callback being called immediately
      mockListenForOAuthMessage.mockImplementation(
        (_win: Window, _origin: string, onSuccess: () => void) => {
          // Call onSuccess asynchronously to simulate real behavior
          setTimeout(() => onSuccess(), 0)
          return () => {}
        },
      )

      await authenticateOAuth(config, { provider: 'google' })

      expect(wallet.auth).toHaveBeenCalledWith({
        type: 'oauth',
        provider: 'google',
      })
      expect(store.getState().setEoaAccount).toHaveBeenCalledWith({
        address: '0xoauth',
      })
      expect(store.getState().setSession).toHaveBeenCalledWith({
        id: 'oauth-session',
      })
      expect(wagmiConnect).toHaveBeenCalledWith(config, { connector })
    })

    it('rejects when wallet.auth fails in success callback', async () => {
      const wallet = createMockWallet()
      wallet.auth.mockRejectedValue(new Error('Auth backend error'))
      const store = createMockStore(wallet)
      const connector = createMockConnector(store)
      const config = createMockConfig(connector)

      mockOpenOAuthPopup.mockReturnValue({ closed: false } as Window)
      mockListenForOAuthMessage.mockImplementation(
        (_win: Window, _origin: string, onSuccess: () => void) => {
          setTimeout(() => onSuccess(), 0)
          return () => {}
        },
      )

      await expect(
        authenticateOAuth(config, { provider: 'google' }),
      ).rejects.toThrow('Auth backend error')
    })

    it('rejects when onError callback is called', async () => {
      const wallet = createMockWallet()
      const store = createMockStore(wallet)
      const connector = createMockConnector(store)
      const config = createMockConfig(connector)

      mockOpenOAuthPopup.mockReturnValue({ closed: false } as Window)
      mockListenForOAuthMessage.mockImplementation(
        (
          _win: Window,
          _origin: string,
          _onSuccess: () => void,
          onError: (error: Error) => void,
        ) => {
          setTimeout(() => onError(new Error('Window closed')), 0)
          return () => {}
        },
      )

      await expect(
        authenticateOAuth(config, { provider: 'google' }),
      ).rejects.toThrow('Window closed')
    })
  })

  describe('exportWallet', () => {
    it('throws when wallet is not initialized', async () => {
      const store = createMockStore(null)
      const connector = createMockConnector(store)
      const config = createMockConfig(connector)

      await expect(
        exportWallet(config, { iframeContainerId: 'export-container' }),
      ).rejects.toThrow('Wallet not initialized')
    })

    it('throws when iframe container not found', async () => {
      const wallet = createMockWallet()
      const store = createMockStore(wallet)
      const connector = createMockConnector(store)
      const config = createMockConfig(connector)

      await expect(
        exportWallet(config, { iframeContainerId: 'nonexistent-container' }),
      ).rejects.toThrow('Iframe container not found')
    })

    it('completes full export wallet flow', async () => {
      const wallet = createMockWallet()
      const store = createMockStore(wallet)
      const connector = createMockConnector(store)
      const config = createMockConfig(connector)

      // Create DOM element for iframe container
      const container = document.createElement('div')
      container.id = 'export-wallet-container'
      document.body.appendChild(container)

      const mockStamper = {
        init: vi.fn().mockResolvedValue('target-public-key'),
        injectWalletExportBundle: vi.fn().mockResolvedValue(true),
      }
      vi.mocked(createIframeStamper).mockResolvedValue(mockStamper as never)
      vi.mocked(exportWalletSdk).mockResolvedValue({
        exportBundle: 'wallet-bundle-data',
        organizationId: 'org-abc',
      } as never)

      await exportWallet(config, {
        iframeContainerId: 'export-wallet-container',
      })

      expect(createIframeStamper).toHaveBeenCalledWith({
        iframeUrl: 'https://export.turnkey.com',
        iframeContainer: container,
        iframeElementId: 'export-wallet-iframe',
      })
      expect(mockStamper.init).toHaveBeenCalled()
      expect(exportWalletSdk).toHaveBeenCalledWith({
        wallet,
        targetPublicKey: 'target-public-key',
      })
      expect(mockStamper.injectWalletExportBundle).toHaveBeenCalledWith(
        'wallet-bundle-data',
        'org-abc',
      )

      document.body.removeChild(container)
    })

    it('throws when inject bundle returns non-true', async () => {
      const wallet = createMockWallet()
      const store = createMockStore(wallet)
      const connector = createMockConnector(store)
      const config = createMockConfig(connector)

      const container = document.createElement('div')
      container.id = 'export-fail-container'
      document.body.appendChild(container)

      const mockStamper = {
        init: vi.fn().mockResolvedValue('pub-key'),
        injectWalletExportBundle: vi.fn().mockResolvedValue(false),
      }
      vi.mocked(createIframeStamper).mockResolvedValue(mockStamper as never)
      vi.mocked(exportWalletSdk).mockResolvedValue({
        exportBundle: 'bundle',
        organizationId: 'org',
      } as never)

      await expect(
        exportWallet(config, { iframeContainerId: 'export-fail-container' }),
      ).rejects.toThrow('Failed to inject export bundle')

      document.body.removeChild(container)
    })
  })

  describe('exportPrivateKey', () => {
    it('throws when wallet is not initialized', async () => {
      const store = createMockStore(null)
      const connector = createMockConnector(store)
      const config = createMockConfig(connector)

      await expect(
        exportPrivateKey(config, { iframeContainerId: 'export-container' }),
      ).rejects.toThrow('Wallet not initialized')
    })

    it('throws when iframe container not found', async () => {
      const wallet = createMockWallet()
      const store = createMockStore(wallet)
      const connector = createMockConnector(store)
      const config = createMockConfig(connector)

      await expect(
        exportPrivateKey(config, {
          iframeContainerId: 'nonexistent-container',
        }),
      ).rejects.toThrow('Iframe container not found')
    })

    it('completes full export private key flow with defaults', async () => {
      const wallet = createMockWallet()
      const store = createMockStore(wallet)
      const connector = createMockConnector(store)
      const config = createMockConfig(connector)

      const container = document.createElement('div')
      container.id = 'export-pk-container'
      document.body.appendChild(container)

      const mockStamper = {
        init: vi.fn().mockResolvedValue('target-pub-key'),
        injectKeyExportBundle: vi.fn().mockResolvedValue(true),
      }
      vi.mocked(createIframeStamper).mockResolvedValue(mockStamper as never)
      vi.mocked(exportPrivateKeySdk).mockResolvedValue({
        exportBundle: 'pk-bundle-data',
        organizationId: 'org-xyz',
      } as never)

      await exportPrivateKey(config, {
        iframeContainerId: 'export-pk-container',
      })

      expect(createIframeStamper).toHaveBeenCalledWith({
        iframeUrl: 'https://export.turnkey.com',
        iframeContainer: container,
        iframeElementId: 'export-private-key-iframe',
      })
      expect(exportPrivateKeySdk).toHaveBeenCalledWith({
        wallet,
        targetPublicKey: 'target-pub-key',
      })
      // Default keyFormat is 'Hexadecimal'
      expect(mockStamper.injectKeyExportBundle).toHaveBeenCalledWith(
        'pk-bundle-data',
        'org-xyz',
        'Hexadecimal',
      )

      document.body.removeChild(container)
    })

    it('passes address and custom keyFormat when provided', async () => {
      const wallet = createMockWallet()
      const store = createMockStore(wallet)
      const connector = createMockConnector(store)
      const config = createMockConfig(connector)

      const container = document.createElement('div')
      container.id = 'export-pk-custom'
      document.body.appendChild(container)

      const mockStamper = {
        init: vi.fn().mockResolvedValue('pub'),
        injectKeyExportBundle: vi.fn().mockResolvedValue(true),
      }
      vi.mocked(createIframeStamper).mockResolvedValue(mockStamper as never)
      vi.mocked(exportPrivateKeySdk).mockResolvedValue({
        exportBundle: 'bundle',
        organizationId: 'org',
      } as never)

      await exportPrivateKey(config, {
        iframeContainerId: 'export-pk-custom',
        address: '0xmyaddress',
        keyFormat: 'Solana',
      })

      expect(exportPrivateKeySdk).toHaveBeenCalledWith({
        wallet,
        targetPublicKey: 'pub',
        address: '0xmyaddress',
      })
      expect(mockStamper.injectKeyExportBundle).toHaveBeenCalledWith(
        'bundle',
        'org',
        'Solana',
      )

      document.body.removeChild(container)
    })

    it('throws when inject key bundle returns non-true', async () => {
      const wallet = createMockWallet()
      const store = createMockStore(wallet)
      const connector = createMockConnector(store)
      const config = createMockConfig(connector)

      const container = document.createElement('div')
      container.id = 'export-pk-fail'
      document.body.appendChild(container)

      const mockStamper = {
        init: vi.fn().mockResolvedValue('pub'),
        injectKeyExportBundle: vi.fn().mockResolvedValue(false),
      }
      vi.mocked(createIframeStamper).mockResolvedValue(mockStamper as never)
      vi.mocked(exportPrivateKeySdk).mockResolvedValue({
        exportBundle: 'bundle',
        organizationId: 'org',
      } as never)

      await expect(
        exportPrivateKey(config, { iframeContainerId: 'export-pk-fail' }),
      ).rejects.toThrow('Failed to inject export bundle')

      document.body.removeChild(container)
    })
  })

  describe('connector lookup', () => {
    it('throws when ZeroDev connector not found in config', async () => {
      const config = {
        connectors: [{ id: 'other-connector' }],
        chains: [],
        state: { chainId: 1, connections: new Map() },
        storage: null,
      } as unknown as Config

      await expect(registerPasskey(config, {})).rejects.toThrow(
        'ZeroDev connector not found in Wagmi config',
      )
    })
  })
})
