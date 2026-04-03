import { describe, expect, it, vi } from 'vitest'
import type { ZeroDevKitConnectorParams } from './connector'
import { zeroDevKitWallet } from './connector'
import type { createStore } from './store'

type Provider = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>
  destroy(): void
}

type KitConnector = {
  setup?(): Promise<void>
  getProvider(): Promise<Provider>
  getKitStore(): ReturnType<typeof createStore>
}

function createMockProvider(): Provider {
  return {
    request: vi.fn().mockResolvedValue('0xhash'),
    destroy: vi.fn(),
  }
}

vi.mock('@zerodev/wallet-react', () => ({
  zeroDevWallet: () => {
    const provider = createMockProvider()
    return () => ({
      id: 'zerodev-wallet',
      name: 'ZeroDevWallet',
      type: 'injected',
      setup: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
      getAccounts: vi.fn(),
      getChainId: vi.fn(),
      getProvider: vi.fn().mockResolvedValue(provider),
      isAuthorized: vi.fn(),
      onAccountsChanged: vi.fn(),
      onChainChanged: vi.fn(),
      onDisconnect: vi.fn(),
    })
  },
}))

function createKitConnector(
  overrides?: Partial<ZeroDevKitConnectorParams>,
): KitConnector {
  const params: ZeroDevKitConnectorParams = {
    projectId: 'test',
    chains: [],
    ...overrides,
  }
  const factory = zeroDevKitWallet(params)
  return factory({} as never) as unknown as KitConnector
}

describe('connector', () => {
  describe('setup', () => {
    it('calls base setup without throwing', async () => {
      const connector = createKitConnector()
      await connector.setup?.()
    })

    it('wraps request by default (prompt is default mode)', async () => {
      const connector = createKitConnector()
      await connector.setup?.()

      const store = connector.getKitStore()
      store.getState().setUserConfirmationListenerActive(true)

      const provider = await connector.getProvider()

      let resolved = false
      const requestPromise = provider
        .request({
          method: 'eth_sendTransaction',
          params: [{ to: '0x1' }],
        })
        .then((result) => {
          resolved = true
          return result
        })

      await new Promise((r) => setTimeout(r, 10))
      expect(resolved).toBe(false)

      store.getState().pendingRequest?.resolve()
      await requestPromise
      expect(resolved).toBe(true)
    })

    it('does not wrap request when signing mode is background', async () => {
      const connector = createKitConnector({
        config: { signing: { mode: 'background' } },
      })
      await connector.setup?.()

      const provider = await connector.getProvider()
      const result = await provider.request({
        method: 'eth_sendTransaction',
        params: [{ to: '0x1' }],
      })
      expect(result).toBe('0xhash')
    })
  })

  describe('signing gate', () => {
    it('passes through when listener is not active', async () => {
      const connector = createKitConnector({
        config: { signing: { mode: 'prompt' } },
      })
      await connector.setup?.()

      const provider = await connector.getProvider()
      const result = await provider.request({
        method: 'eth_sendTransaction',
        params: [{ to: '0x1' }],
      })
      expect(result).toBe('0xhash')
    })

    it('passes through for non-signing methods even when listener is active', async () => {
      const connector = createKitConnector({
        config: { signing: { mode: 'prompt' } },
      })
      await connector.setup?.()

      const store = connector.getKitStore()
      store.getState().setUserConfirmationListenerActive(true)

      const provider = await connector.getProvider()
      const result = await provider.request({ method: 'eth_chainId' })
      expect(result).toBe('0xhash')
    })

    it('gates request when listener is active and method matches', async () => {
      const connector = createKitConnector({
        config: { signing: { mode: 'prompt' } },
      })
      await connector.setup?.()

      const store = connector.getKitStore()
      store.getState().setUserConfirmationListenerActive(true)

      const provider = await connector.getProvider()

      let resolved = false
      const requestPromise = provider
        .request({
          method: 'eth_sendTransaction',
          params: [{ to: '0x1' }],
        })
        .then((result) => {
          resolved = true
          return result
        })

      // Request should be pending
      await new Promise((r) => setTimeout(r, 10))
      expect(resolved).toBe(false)
      expect(store.getState().pendingRequest).not.toBeNull()
      expect(store.getState().pendingRequest?.method).toBe(
        'eth_sendTransaction',
      )

      // Confirm — resolve the gate
      store.getState().pendingRequest?.resolve()
      const result = await requestPromise
      expect(resolved).toBe(true)
      expect(result).toBe('0xhash')
    })

    it('rejects request when user rejects', async () => {
      const connector = createKitConnector({
        config: { signing: { mode: 'prompt' } },
      })
      await connector.setup?.()

      const store = connector.getKitStore()
      store.getState().setUserConfirmationListenerActive(true)

      const provider = await connector.getProvider()

      const requestPromise = provider.request({
        method: 'personal_sign',
        params: ['0xdata', '0xaddress'],
      })

      await new Promise((r) => setTimeout(r, 10))
      store.getState().pendingRequest?.reject(new Error('User rejected'))

      await expect(requestPromise).rejects.toThrow('User rejected')
    })

    it('respects custom methods list', async () => {
      const connector = createKitConnector({
        config: {
          signing: {
            mode: 'prompt',
            methods: ['eth_sendTransaction'],
          },
        },
      })
      await connector.setup?.()

      const store = connector.getKitStore()
      store.getState().setUserConfirmationListenerActive(true)

      const provider = await connector.getProvider()

      // personal_sign is NOT in the custom methods list — should pass through
      const result = await provider.request({
        method: 'personal_sign',
        params: ['0xdata', '0xaddress'],
      })
      expect(result).toBe('0xhash')
      expect(store.getState().pendingRequest).toBeNull()
    })
  })

  describe('getKitStore', () => {
    it('exposes the store', () => {
      const connector = createKitConnector()
      const store = connector.getKitStore()
      expect(store).toBeDefined()
      expect(store.getState().pendingRequest).toBeNull()
    })
  })
})
