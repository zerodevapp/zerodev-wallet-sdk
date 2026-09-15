import type { Config } from '@wagmi/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mainnet, sepolia } from 'wagmi/chains'

// SDK mocks — hoisted so they're defined before vi.mock() (which is itself
// hoisted to the top of the file by vitest).
const {
  createKernelAccountMock,
  createKernelAccountClientMock,
  createZeroDevPaymasterClientMock,
  signerToEcdsaValidatorMock,
  createWalletClientMock,
  mockEoaAccount,
} = vi.hoisted(() => ({
  createKernelAccountMock: vi.fn().mockResolvedValue({
    address: '0xcafecafecafecafecafecafecafecafecafecafe',
  }),
  createKernelAccountClientMock: vi.fn().mockReturnValue({}),
  createZeroDevPaymasterClientMock: vi.fn().mockReturnValue({}),
  signerToEcdsaValidatorMock: vi.fn().mockResolvedValue({ name: 'ecdsa' }),
  createWalletClientMock: vi.fn().mockReturnValue({}),
  mockEoaAccount: {
    address: '0xe0a0e0a0e0a0e0a0e0a0e0a0e0a0e0a0e0a0e0a0' as const,
  },
}))

vi.mock('@zerodev/sdk', () => ({
  createKernelAccount: createKernelAccountMock,
  createKernelAccountClient: createKernelAccountClientMock,
  createZeroDevPaymasterClient: createZeroDevPaymasterClientMock,
}))
vi.mock('@zerodev/sdk/constants', () => ({
  getEntryPoint: vi.fn().mockReturnValue({ version: '0.7' }),
  KERNEL_V3_3: 'v3.3',
}))
vi.mock('@zerodev/ecdsa-validator', () => ({
  signerToEcdsaValidator: signerToEcdsaValidatorMock,
}))

// Mock viem partially — preserve `http()` etc., stub the clients we care
// about.
vi.mock('viem', async () => {
  const actual = await vi.importActual<typeof import('viem')>('viem')
  return {
    ...actual,
    createPublicClient: vi.fn().mockReturnValue({}),
    createWalletClient: createWalletClientMock,
  }
})

vi.mock('@zerodev/wallet-core', () => ({
  KMS_SERVER_URL: 'https://kms.example.com',
  createZeroDevWallet: vi.fn().mockResolvedValue({
    getSession: vi.fn().mockResolvedValue(null),
    toAccount: vi.fn().mockResolvedValue(mockEoaAccount),
    auth: vi.fn(),
    logout: vi.fn().mockResolvedValue(true),
    refreshSession: vi.fn(),
  }),
}))

import { zeroDevWalletCore } from './core/connector.js'

type ConnectorInstance = ReturnType<ReturnType<typeof zeroDevWalletCore>>

function isRefreshProvider(value: unknown): value is { destroy: () => void } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'destroy' in value &&
    typeof value.destroy === 'function'
  )
}

function createConnector(mode?: 'EOA' | '4337' | '7702'): ConnectorInstance {
  const factory = zeroDevWalletCore({
    projectId: 'proj-test',
    chains: [sepolia],
    ...(mode && { mode }),
  })
  const wagmiConfig = {
    transports: {},
    emitter: { emit: vi.fn() },
    storage: null,
  } as unknown as Config
  return factory(wagmiConfig as never) as ConnectorInstance
}

async function seedEoa(connector: ConnectorInstance) {
  // @ts-expect-error - getStore is added in the connector's Properties.
  const store = await connector.getStore()
  store.getState().setEoaAccount(mockEoaAccount)
}

describe('zeroDevWallet connector — mode branching', () => {
  beforeEach(() => {
    createKernelAccountMock.mockClear()
    createKernelAccountClientMock.mockClear()
    createZeroDevPaymasterClientMock.mockClear()
    signerToEcdsaValidatorMock.mockClear()
    createWalletClientMock.mockClear()
  })

  describe('connect()', () => {
    it('does not create a kernel account when Core has no live session', async () => {
      const connector = createConnector()

      await expect(connector.connect({ chainId: sepolia.id })).rejects.toThrow(
        /not authenticated/i,
      )

      expect(createKernelAccountMock).not.toHaveBeenCalled()
      expect(createKernelAccountClientMock).not.toHaveBeenCalled()
    })

    it('drops a stale rehydrated session when Core reports none', async () => {
      // An older SDK version may have persisted a session into React storage.
      // Core (mocked getSession → null) is the source of truth, so init must
      // erase the rehydrated session while still honoring the chain preference.
      const persistedStale = JSON.stringify({
        state: {
          activeChainId: sepolia.id,
          session: {
            id: 'stale-session',
            userId: 'user-1',
            organizationId: 'org-1',
            stamperType: 'apiKey',
            token: 'stale-jwt',
            expiry: Date.now() + 60_000,
            createdAt: Date.now(),
          },
        },
        version: 0,
      })
      const persistStorage = {
        getItem: vi.fn().mockReturnValue(persistedStale),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      }
      const factory = zeroDevWalletCore({
        projectId: 'proj-test',
        chains: [sepolia],
        persistStorage: persistStorage as never,
      })
      const wagmiConfig = {
        transports: {},
        emitter: { emit: vi.fn() },
        storage: null,
      } as unknown as Config
      const connector = factory(wagmiConfig as never) as ConnectorInstance

      // @ts-expect-error - getStore is added in the connector's Properties.
      const store = await connector.getStore()

      expect(store.getState().session).toBeNull()
      // Chain preference survives rehydration — proves the stale state loaded.
      expect(store.getState().activeChainId).toBe(sepolia.id)
    })

    it("default mode is '7702' (passes eip7702Account, no ECDSA plugin)", async () => {
      const connector = createConnector()
      await seedEoa(connector)

      await connector.connect({ chainId: sepolia.id })

      expect(createKernelAccountMock).toHaveBeenCalledOnce()
      const [, params] = createKernelAccountMock.mock.calls[0]
      expect(params.eip7702Account).toBe(mockEoaAccount)
      expect(params.plugins).toBeUndefined()
      expect(signerToEcdsaValidatorMock).not.toHaveBeenCalled()
      expect(createWalletClientMock).not.toHaveBeenCalled()
    })

    it("mode='4337' builds an ECDSA-validator plugin, no eip7702Account", async () => {
      const connector = createConnector('4337')
      await seedEoa(connector)

      await connector.connect({ chainId: sepolia.id })

      expect(signerToEcdsaValidatorMock).toHaveBeenCalledOnce()
      expect(signerToEcdsaValidatorMock.mock.calls[0][1].signer).toBe(
        mockEoaAccount,
      )
      const [, params] = createKernelAccountMock.mock.calls[0]
      expect(params.eip7702Account).toBeUndefined()
      expect(params.plugins.sudo).toBeDefined()
      expect(createWalletClientMock).not.toHaveBeenCalled()
    })

    it("mode='EOA' creates a wallet client and skips the kernel entirely", async () => {
      const connector = createConnector('EOA')
      await seedEoa(connector)

      const result = await connector.connect({ chainId: sepolia.id })

      expect(createWalletClientMock).toHaveBeenCalledOnce()
      expect(createKernelAccountMock).not.toHaveBeenCalled()
      expect(signerToEcdsaValidatorMock).not.toHaveBeenCalled()
      // EOA address is what wagmi sees in EOA mode.
      expect(result.accounts).toEqual([mockEoaAccount.address])
    })

    it("mode='4337' returns the kernel counterfactual address, not the EOA", async () => {
      const connector = createConnector('4337')
      await seedEoa(connector)

      const result = await connector.connect({ chainId: sepolia.id })

      expect(result.accounts).toEqual([
        '0xcafecafecafecafecafecafecafecafecafecafe',
      ])
    })

    it('retries the whole chain setup after client creation fails', async () => {
      createKernelAccountClientMock.mockImplementationOnce(() => {
        throw new Error('bundler client failed')
      })
      const connector = createConnector('4337')
      await seedEoa(connector)

      await expect(connector.connect({ chainId: sepolia.id })).rejects.toThrow(
        'bundler client failed',
      )
      await connector.connect({ chainId: sepolia.id })

      expect(createKernelAccountClientMock).toHaveBeenCalledTimes(2)
    })
  })

  describe('switchChain()', () => {
    it('does not persist an unsupported chain when setup fails', async () => {
      const connector = createConnector('4337')
      await seedEoa(connector)
      // @ts-expect-error - getStore is added in the connector's Properties.
      const store = await connector.getStore()
      store.getState().setActiveChainId(sepolia.id)
      const switchChain = connector.switchChain
      if (!switchChain) throw new Error('Expected connector.switchChain')

      await expect(switchChain({ chainId: 1 })).rejects.toThrow(
        'Chain 1 not found in config',
      )

      await expect(connector.getChainId()).resolves.toBe(sepolia.id)
    })

    it('does not commit the new chain when its setup fails', async () => {
      // The target chain IS in config, but building its client blows up. The
      // active chain must stay on the previous one — no half-switched state.
      createKernelAccountClientMock.mockImplementationOnce(() => {
        throw new Error('chain setup failed')
      })
      const factory = zeroDevWalletCore({
        projectId: 'proj-test',
        chains: [sepolia, mainnet],
        mode: '4337',
      })
      const wagmiConfig = {
        transports: {},
        emitter: { emit: vi.fn() },
        storage: null,
      } as unknown as Config
      const connector = factory(wagmiConfig as never) as ConnectorInstance
      await seedEoa(connector)
      // @ts-expect-error - getStore is added in the connector's Properties.
      const store = await connector.getStore()
      store.getState().setActiveChainId(sepolia.id)
      const switchChain = connector.switchChain
      if (!switchChain) throw new Error('Expected connector.switchChain')

      await expect(switchChain({ chainId: mainnet.id })).rejects.toThrow(
        'chain setup failed',
      )

      await expect(connector.getChainId()).resolves.toBe(sepolia.id)
      expect(store.getState().kernelAccounts.has(mainnet.id)).toBe(false)
    })
  })

  describe('getAccounts()', () => {
    it("mode='EOA' returns the EOA address before connect()", async () => {
      const connector = createConnector('EOA')
      await seedEoa(connector)

      const accounts = await connector.getAccounts()
      expect(accounts).toEqual([mockEoaAccount.address])
    })

    it("mode='4337' returns [] before connect() so we never leak the EOA address", async () => {
      const connector = createConnector('4337')
      await seedEoa(connector)

      // No connect() yet → no kernel account in store. Must NOT fall back
      // to the EOA address — that's a different account in 4337.
      const accounts = await connector.getAccounts()
      expect(accounts).toEqual([])
    })
  })

  it('recreates the refresh provider after disconnect on the same page', async () => {
    const connector = createConnector()
    const firstProvider = await connector.getProvider()

    await connector.disconnect()

    const nextProvider = await connector.getProvider()
    expect(nextProvider).not.toBe(firstProvider)
  })

  it('stops refresh but preserves retryable state when logout fails', async () => {
    const connector = createConnector()
    await seedEoa(connector)
    // @ts-expect-error - getStore is added in the connector's Properties.
    const store = await connector.getStore()
    const wallet = store.getState().wallet
    if (!wallet) throw new Error('Expected initialized wallet')
    vi.mocked(wallet.logout).mockRejectedValueOnce(new Error('backend down'))
    const provider = await connector.getProvider()
    if (!isRefreshProvider(provider))
      throw new Error('Expected refresh provider')
    const destroy = vi.spyOn(provider, 'destroy')

    await expect(connector.disconnect()).rejects.toThrow('backend down')

    expect(destroy).toHaveBeenCalledOnce()
    expect(store.getState().eoaAccount).toBe(mockEoaAccount)
  })
})

describe('lazy cross-chain setup (provider builds on demand)', () => {
  beforeEach(() => {
    createKernelAccountMock.mockClear()
    createKernelAccountClientMock.mockReturnValue({
      sendUserOperation: vi.fn().mockResolvedValue('0xhash'),
    })
  })

  function createMultiChainConnector(): ConnectorInstance {
    const factory = zeroDevWalletCore({
      projectId: 'proj-test',
      chains: [sepolia, mainnet],
      mode: '7702',
    })
    const wagmiConfig = {
      transports: {},
      emitter: { emit: vi.fn() },
      storage: null,
    } as unknown as Config
    return factory(wagmiConfig as never) as ConnectorInstance
  }

  async function sendCallsOnMainnetAfterSepoliaConnect() {
    const connector = createMultiChainConnector()
    await seedEoa(connector)
    await connector.connect({ chainId: sepolia.id })
    // Ignore the sepolia build done by connect(); count only lazy builds.
    createKernelAccountMock.mockClear()
    const provider = (await connector.getProvider()) as {
      request: (args: {
        method: string
        params?: unknown[]
      }) => Promise<unknown>
    }
    return () =>
      provider.request({
        method: 'wallet_sendCalls',
        params: [
          {
            from: mockEoaAccount.address,
            chainId: `0x${mainnet.id.toString(16)}`,
            calls: [{ data: '0x' }],
          },
        ],
      })
  }

  it('builds the kernel client for a chain that was never connected to', async () => {
    const sendCallsOnMainnet = await sendCallsOnMainnetAfterSepoliaConnect()

    const result = await sendCallsOnMainnet()

    // connect() only set up sepolia; mainnet was built lazily by the provider.
    expect(createKernelAccountMock).toHaveBeenCalledOnce()
    expect(result).toEqual({ id: `0xhash:${mainnet.id}` })
  })

  it('de-dupes concurrent builds of the same fresh chain (createKernelAccount runs once)', async () => {
    const sendCallsOnMainnet = await sendCallsOnMainnetAfterSepoliaConnect()

    await Promise.all([sendCallsOnMainnet(), sendCallsOnMainnet()])

    // Without the in-flight guard both concurrent sends would each build the
    // account; the guard collapses them to a single createKernelAccount call.
    expect(createKernelAccountMock).toHaveBeenCalledOnce()
  })

  it('does not commit a build whose owner changed mid-flight (no signer leak)', async () => {
    // Deferred kernel construction so we can swap the owner while it's in flight.
    let started!: () => void
    const startedP = new Promise<void>((r) => {
      started = r
    })
    let finish!: () => void
    createKernelAccountMock.mockImplementationOnce(() => {
      started()
      return new Promise((resolve) => {
        finish = () =>
          resolve({ address: '0xcafecafecafecafecafecafecafecafecafecafe' })
      })
    })

    const connector = createMultiChainConnector()
    await seedEoa(connector) // owner A
    // @ts-expect-error - getStore is added in the connector's Properties.
    const store = await connector.getStore()
    store.getState().setActiveChainId(sepolia.id)
    const provider = (await connector.getProvider()) as {
      request: (a: { method: string; params?: unknown[] }) => Promise<unknown>
    }

    // Start a build on mainnet (never connected) — hangs on the deferred build.
    const sendP = provider
      .request({
        method: 'wallet_sendCalls',
        params: [
          {
            from: mockEoaAccount.address,
            chainId: `0x${mainnet.id.toString(16)}`,
            calls: [{ data: '0x' }],
          },
        ],
      })
      .catch((e) => e)

    await startedP // owner-A build is now in flight

    // Owner changes to B before A's build resolves.
    store.getState().setEoaAccount({
      address: '0xB0B0B0B0B0B0B0B0B0B0B0B0B0B0B0B0B0B0B0B0',
    } as never)

    finish() // A's build resolves now
    await sendP

    // A's stale build must NOT land in B's store.
    expect(store.getState().kernelAccounts.get(mainnet.id)).toBeUndefined()
    expect(store.getState().kernelClients.get(mainnet.id)).toBeUndefined()
  })
})
