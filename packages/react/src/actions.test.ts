import type { Config, Connector } from '@wagmi/core'
import { connect as wagmiConnect } from '@wagmi/core/actions'
import {
  createIframeStamper,
  exportPrivateKey as exportPrivateKeySdk,
  exportWallet as exportWalletSdk,
} from '@zerodev/wallet-core'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getAuthenticators,
  loginPasskey,
  refreshSession,
  registerPasskey,
  sendOTP,
  verifyOTP,
} from './actions.js'
import { exportPrivateKey } from './web/exportPrivateKey.js'
import { exportWallet } from './web/exportWallet.js'

// Mock wagmi connect
vi.mock('@wagmi/core/actions', () => ({
  connect: vi.fn().mockResolvedValue({}),
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
      getAuthenticators: vi.fn().mockResolvedValue({
        oauths: [],
        passkeys: [],
        emailContacts: [{ email: 'user@example.com' }],
        apiKeys: [],
      }),
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

    it('returns otpId and otpEncryptionTargetBundle from wallet auth', async () => {
      const wallet = createMockWallet()
      wallet.auth.mockResolvedValue({
        otpId: 'otp-456',
        otpEncryptionTargetBundle: 'bundle-from-auth',
      })
      const store = createMockStore(wallet)
      const connector = createMockConnector(store)
      const config = createMockConfig(connector)

      const result = await sendOTP(config, { email: 'user@example.com' })

      expect(result).toEqual({
        otpId: 'otp-456',
        otpEncryptionTargetBundle: 'bundle-from-auth',
      })
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

      await verifyOTP(config, {
        code: '123456',
        otpId: 'otp-123',
        otpEncryptionTargetBundle: 'bundle-stub',
      })

      expect(wallet.auth).toHaveBeenCalledWith({
        type: 'otp',
        mode: 'verifyOtp',
        otpId: 'otp-123',
        otpCode: '123456',
        otpEncryptionTargetBundle: 'bundle-stub',
      })
    })

    it('sets session and account with correct values after verification', async () => {
      const wallet = createMockWallet()
      wallet.getSession.mockResolvedValue({ id: 'verify-sess' })
      wallet.toAccount.mockResolvedValue({ address: '0xverified' })
      const store = createMockStore(wallet)
      const connector = createMockConnector(store)
      const config = createMockConfig(connector)

      await verifyOTP(config, {
        code: '123456',
        otpId: 'otp-123',
        otpEncryptionTargetBundle: 'bundle-stub',
      })

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

      await verifyOTP(config, {
        code: '123456',
        otpId: 'otp-123',
        otpEncryptionTargetBundle: 'bundle-stub',
      })

      expect(wagmiConnect).toHaveBeenCalledWith(config, { connector })
    })

    it('throws when wallet is not initialized', async () => {
      const store = createMockStore(null)
      const connector = createMockConnector(store)
      const config = createMockConfig(connector)

      await expect(
        verifyOTP(config, {
          code: '123456',
          otpId: 'otp-123',
          otpEncryptionTargetBundle: 'bundle-stub',
        }),
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
        'Wallet not initialized',
      )
    })
  })

  describe('getAuthenticators', () => {
    it('calls wallet.client.getAuthenticators with parameters', async () => {
      const wallet = createMockWallet()
      const session = {
        id: 'session-123',
        organizationId: 'org-123',
        token: 'test-token',
      }
      const store = createMockStore(wallet, session)
      const connector = createMockConnector(store)
      const config = createMockConfig(connector)

      await getAuthenticators(config)

      expect(wallet.client.getAuthenticators).toHaveBeenCalledWith({
        subOrganizationId: 'org-123',
        projectId: 'proj-123',
        token: 'test-token',
      })
    })

    it('returns authenticators from wallet client', async () => {
      const wallet = createMockWallet()
      const response = {
        oauths: [{ provider: 'google', clientId: 'cid', subject: 'sub' }],
        passkeys: [],
        emailContacts: [],
        apiKeys: [],
      }
      wallet.client.getAuthenticators.mockResolvedValue(response)
      const session = {
        id: 'session-123',
        organizationId: 'org-123',
        token: 'test-token',
      }
      const store = createMockStore(wallet, session)
      const connector = createMockConnector(store)
      const config = createMockConfig(connector)

      const result = await getAuthenticators(config)

      expect(result).toEqual(response)
    })

    it('throws when wallet is not initialized', async () => {
      const store = createMockStore(null)
      const connector = createMockConnector(store)
      const config = createMockConfig(connector)

      await expect(getAuthenticators(config)).rejects.toThrow(
        'Wallet not initialized',
      )
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
