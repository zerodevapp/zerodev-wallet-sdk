import type { KernelAccountClient } from '@zerodev/sdk'
import { privateKeyToAccount } from 'viem/accounts'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mainnet, sepolia } from 'wagmi/chains'
import type { WalletMode } from './core/connector.js'
import { createProvider } from './provider.js'
import { createZeroDevWalletStore } from './store.js'

const EOA_ACCOUNT = privateKeyToAccount(`0x${'11'.repeat(32)}`)
const EOA_ADDRESS = EOA_ACCOUNT.address

const sendUserOperationMock = vi.fn()
const getUserOperationReceiptMock = vi.fn()

const mockKernelClient = {
  sendUserOperation: sendUserOperationMock,
  getUserOperationReceipt: getUserOperationReceiptMock,
} as unknown as KernelAccountClient

function createTestProvider(mode?: WalletMode) {
  const store = createZeroDevWalletStore()
  store.getState().setActiveChainId(sepolia.id)
  store.getState().setEoaAccount(EOA_ACCOUNT)
  store.getState().setKernelClient(sepolia.id, mockKernelClient)

  return createProvider({
    store,
    config: {
      projectId: 'proj-test',
      chains: [sepolia],
      ...(mode && { mode }),
    },
    chains: [sepolia],
  })
}

beforeEach(() => {
  sendUserOperationMock.mockReset()
  getUserOperationReceiptMock.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('wallet_sendCalls', () => {
  it('submits a userOp and returns its hash as the bundle id', async () => {
    sendUserOperationMock.mockResolvedValue('0xuserophash')
    const provider = createTestProvider()

    const result = await provider.request({
      method: 'wallet_sendCalls',
      params: [
        {
          from: EOA_ADDRESS,
          calls: [
            { to: '0x1111111111111111111111111111111111111111', value: '0x1' },
            { data: '0xdeadbeef' },
          ],
        },
      ],
    })

    expect(result).toEqual({ id: '0xuserophash:11155111' })
    expect(sendUserOperationMock).toHaveBeenCalledWith({
      calls: [
        {
          to: '0x1111111111111111111111111111111111111111',
          value: 1n,
          data: '0x',
        },
        { value: 0n, data: '0xdeadbeef' },
      ],
    })
  })

  it('treats value "0x" as 0n (does not throw)', async () => {
    sendUserOperationMock.mockResolvedValue('0xuserophash')
    const provider = createTestProvider()

    await provider.request({
      method: 'wallet_sendCalls',
      params: [{ from: EOA_ADDRESS, calls: [{ data: '0x', value: '0x' }] }],
    })

    expect(sendUserOperationMock).toHaveBeenCalledWith({
      calls: [{ value: 0n, data: '0x' }],
    })
  })

  it('rejects in EOA mode', async () => {
    const provider = createTestProvider('EOA')

    await expect(
      provider.request({
        method: 'wallet_sendCalls',
        params: [{ calls: [{ data: '0x' }] }],
      }),
    ).rejects.toThrow('wallet_sendCalls is not supported in EOA mode')
    expect(sendUserOperationMock).not.toHaveBeenCalled()
  })

  it('rejects a mismatched from address', async () => {
    const provider = createTestProvider()

    await expect(
      provider.request({
        method: 'wallet_sendCalls',
        params: [
          {
            from: '0xdead000000000000000000000000000000000000',
            calls: [{ data: '0x' }],
          },
        ],
      }),
    ).rejects.toThrow('Invalid from address')
  })

  it.each([
    ['missing', {}],
    ['not an array', { calls: 'nope' }],
    ['empty', { calls: [] }],
  ])('rejects when calls is %s', async (_label, request) => {
    const provider = createTestProvider()

    await expect(
      provider.request({ method: 'wallet_sendCalls', params: [request] }),
    ).rejects.toThrow('Missing calls')
    expect(sendUserOperationMock).not.toHaveBeenCalled()
  })
})

describe('wallet_getCallsStatus', () => {
  it('returns pending (100) while the userOp has no receipt', async () => {
    getUserOperationReceiptMock.mockRejectedValue(new Error('not found'))
    const provider = createTestProvider()

    const result = await provider.request({
      method: 'wallet_getCallsStatus',
      params: ['0xuserophash'],
    })

    expect(result).toEqual({
      version: '2.0.0',
      atomic: true,
      status: 100,
      receipts: [],
    })
  })

  it('returns success (200) with the receipt re-encoded as RPC hex', async () => {
    getUserOperationReceiptMock.mockResolvedValue({
      success: true,
      // Scoped to this userOp — this is what must end up in the response.
      logs: [
        {
          address: '0xcontract',
          topics: ['0xtopic1', '0xtopic2'],
          data: '0xlogdata',
          blockNumber: 123n,
          logIndex: 7,
        },
      ],
      receipt: {
        transactionHash: '0xtxhash',
        blockHash: '0xblockhash',
        blockNumber: 123n,
        gasUsed: 456n,
        status: 'success',
        logs: [{ address: '0xother', topics: [], data: '0x' }],
      },
    })
    const provider = createTestProvider()

    const result = await provider.request({
      method: 'wallet_getCallsStatus',
      params: ['0xuserophash'],
    })

    expect(result).toEqual({
      version: '2.0.0',
      atomic: true,
      chainId: `0x${sepolia.id.toString(16)}`,
      status: 200,
      receipts: [
        {
          transactionHash: '0xtxhash',
          blockHash: '0xblockhash',
          blockNumber: '0x7b',
          gasUsed: '0x1c8',
          status: '0x1',
          logs: [
            {
              address: '0xcontract',
              topics: ['0xtopic1', '0xtopic2'],
              data: '0xlogdata',
            },
          ],
        },
      ],
    })
  })

  it('returns failure (500) when the userOp reverted', async () => {
    getUserOperationReceiptMock.mockResolvedValue({
      success: false,
      logs: [],
      receipt: {
        transactionHash: '0xtxhash',
        blockHash: '0xblockhash',
        blockNumber: 123n,
        gasUsed: 456n,
        status: 'reverted',
        logs: [],
      },
    })
    const provider = createTestProvider()

    const result = (await provider.request({
      method: 'wallet_getCallsStatus',
      params: ['0xuserophash'],
    })) as { status: number; receipts: { status: string }[] }

    expect(result.status).toBe(500)
    expect(result.receipts[0].status).toBe('0x0')
  })

  it("reports the bundle id's chain, not the active chain", async () => {
    getUserOperationReceiptMock.mockResolvedValue({
      success: true,
      logs: [],
      receipt: {
        transactionHash: '0xtxhash',
        blockHash: '0xblockhash',
        blockNumber: 1n,
        gasUsed: 1n,
        status: 'success',
        logs: [],
      },
    })
    // Active chain is sepolia, but the bundle was submitted on mainnet — the
    // status response must reflect the bundle's chain, not the active one.
    const store = createZeroDevWalletStore()
    store.getState().setActiveChainId(sepolia.id)
    store.getState().setEoaAccount(EOA_ACCOUNT)
    store.getState().setKernelClient(mainnet.id, mockKernelClient)
    const provider = createProvider({
      store,
      config: { projectId: 'proj-test', chains: [sepolia, mainnet] },
      chains: [sepolia, mainnet],
    })

    const result = (await provider.request({
      method: 'wallet_getCallsStatus',
      params: [`0xuserophash:${mainnet.id}`],
    })) as { chainId: string }

    expect(result.chainId).toBe(`0x${mainnet.id.toString(16)}`)
  })
})

describe('wallet_getCapabilities', () => {
  it('declares atomic support only for configured chains in kernel modes', async () => {
    // createTestProvider config.chains is [sepolia] — mainnet (0x1) is not
    // configured, so we must not claim atomic support for a chain we can never
    // build a kernel client for.
    const provider = createTestProvider()

    const result = await provider.request({
      method: 'wallet_getCapabilities',
      params: [EOA_ADDRESS, ['0xaa36a7', '0x1']],
    })

    expect(result).toEqual({
      '0xaa36a7': { atomic: { status: 'supported' } },
      '0x1': { atomic: { status: 'unsupported' } },
    })
  })

  it('falls back to the active chain when no chains are requested', async () => {
    const provider = createTestProvider()

    const result = await provider.request({
      method: 'wallet_getCapabilities',
    })

    expect(result).toEqual({
      [`0x${sepolia.id.toString(16)}`]: {
        atomic: { status: 'supported' },
      },
    })
  })

  it('declares atomic unsupported in EOA mode', async () => {
    const provider = createTestProvider('EOA')

    const result = (await provider.request({
      method: 'wallet_getCapabilities',
      params: [EOA_ADDRESS, ['0xaa36a7']],
    })) as Record<string, { atomic: { status: string } }>

    expect(result['0xaa36a7'].atomic.status).toBe('unsupported')
  })
})

describe('provider state safety', () => {
  it('auto-refreshes a 15-minute session at the default one-minute threshold', () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_700_000_000_000)
    const store = createZeroDevWalletStore()
    const wallet = {
      refreshSession: vi.fn().mockReturnValue(new Promise(() => {})),
    }
    store.getState().setWallet(wallet as never)
    store.getState().setSession({
      id: 'fifteen-minute-session',
      userId: 'user-1',
      organizationId: 'org-1',
      stamperType: 'apiKey',
      token: 'jwt',
      expiry: Date.now() + 15 * 60_000,
      createdAt: Date.now(),
    })

    const provider = createProvider({
      store,
      config: { projectId: 'proj-test', chains: [sepolia] },
      chains: [sepolia],
    })
    vi.advanceTimersByTime(14 * 60_000 - 1)
    expect(wallet.refreshSession).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(wallet.refreshSession).toHaveBeenCalledOnce()
    provider.destroy()
  })

  it('does not let an in-flight refresh restore a cleared session', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_700_000_000_000)
    const store = createZeroDevWalletStore()
    const session = {
      id: 'session-1',
      userId: 'user-1',
      organizationId: 'org-1',
      stamperType: 'apiKey' as const,
      token: 'jwt',
      expiry: Date.now() + 30_000,
      createdAt: Date.now(),
    }
    const replacement = { ...session, id: 'session-2', token: 'new-jwt' }
    let resolveRefresh = (_session: typeof replacement) => {}
    const refresh = new Promise<typeof replacement>((resolve) => {
      resolveRefresh = resolve
    })
    const wallet = { refreshSession: vi.fn().mockReturnValue(refresh) }
    store.getState().setWallet(wallet as never)
    store.getState().setSession(session)
    store.getState().setEoaAccount(EOA_ACCOUNT)

    const provider = createProvider({
      store,
      config: { projectId: 'proj-test', chains: [sepolia] },
      chains: [sepolia],
    })
    await vi.waitFor(() => expect(wallet.refreshSession).toHaveBeenCalledOnce())

    store.getState().clear()
    resolveRefresh(replacement)
    await refresh
    await Promise.resolve()

    expect(store.getState().session).toBeNull()
    expect(store.getState().eoaAccount).toBeNull()
    provider.destroy()
  })

  it('clears a session that expired while hidden without refreshing it', () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_700_000_000_000)
    const store = createZeroDevWalletStore()
    const wallet = { refreshSession: vi.fn() }
    store.getState().setWallet(wallet as never)
    store.getState().setSession({
      id: 'expired-in-background',
      userId: 'user-1',
      organizationId: 'org-1',
      stamperType: 'apiKey',
      token: 'jwt',
      expiry: Date.now() + 120_000,
      createdAt: Date.now(),
    })
    store.getState().setEoaAccount(EOA_ACCOUNT)
    store
      .getState()
      .setKernelAccount(sepolia.id, { address: EOA_ADDRESS } as never)
    store.getState().setKernelClient(sepolia.id, mockKernelClient)

    const provider = createProvider({
      store,
      config: { projectId: 'proj-test', chains: [sepolia] },
      chains: [sepolia],
    })
    vi.setSystemTime(Date.now() + 121_000)
    expect(document.visibilityState).toBe('visible')
    document.dispatchEvent(new Event('visibilitychange'))

    expect(wallet.refreshSession).not.toHaveBeenCalled()
    expect(store.getState().session).toBeNull()
    expect(store.getState().eoaAccount).toBeNull()
    expect(store.getState().kernelAccounts.size).toBe(0)
    expect(store.getState().kernelClients.size).toBe(0)
    provider.destroy()
  })

  it('preserves a still-valid identity when auto-refresh fails transiently', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_700_000_000_000)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout')
    const store = createZeroDevWalletStore()
    const session = {
      id: 'session-1',
      userId: 'user-1',
      organizationId: 'org-1',
      stamperType: 'apiKey' as const,
      token: 'jwt',
      expiry: Date.now() + 30_000,
      createdAt: Date.now(),
    }
    const wallet = {
      refreshSession: vi.fn().mockRejectedValue(new Error('network down')),
    }
    store.getState().setWallet(wallet as never)
    store.getState().setSession(session)
    store.getState().setEoaAccount(EOA_ACCOUNT)

    const provider = createProvider({
      store,
      config: { projectId: 'proj-test', chains: [sepolia] },
      chains: [sepolia],
    })
    await vi.waitFor(() => expect(wallet.refreshSession).toHaveBeenCalledOnce())
    await Promise.resolve()

    expect(store.getState().session).toEqual(session)
    expect(store.getState().eoaAccount?.address).toBe(EOA_ADDRESS)
    expect(vi.getTimerCount()).toBeGreaterThan(0)
    // The retry must land within the 5s cap, not just "some timer exists".
    // The session has 30s left, so an uncapped retry would schedule 30_000ms.
    const scheduledDelays = setTimeoutSpy.mock.calls
      .map(([, delay]) => delay)
      .filter((delay): delay is number => typeof delay === 'number')
    expect(scheduledDelays.length).toBeGreaterThan(0)
    expect(Math.max(...scheduledDelays)).toBeLessThanOrEqual(5_000)
    provider.destroy()
  })

  it('clears a session rejected during auto-refresh instead of retrying it', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_700_000_000_000)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const store = createZeroDevWalletStore()
    const wallet = {
      refreshSession: vi.fn().mockRejectedValue({ status: 401 }),
      logout: vi.fn().mockResolvedValue(true),
    }
    store.getState().setWallet(wallet as never)
    store.getState().setSession({
      id: 'rejected-session',
      userId: 'user-1',
      organizationId: 'org-1',
      stamperType: 'apiKey',
      token: 'jwt',
      expiry: Date.now() + 30_000,
      createdAt: Date.now(),
    })
    store.getState().setEoaAccount(EOA_ACCOUNT)

    const provider = createProvider({
      store,
      config: { projectId: 'proj-test', chains: [sepolia] },
      chains: [sepolia],
    })
    await vi.waitFor(() => expect(wallet.logout).toHaveBeenCalledOnce())

    expect(wallet.logout).toHaveBeenCalledWith()
    expect(store.getState().session).toBeNull()
    expect(store.getState().eoaAccount).toBeNull()
    provider.destroy()
  })

  it('preserves retryable state when rejected-session cleanup also fails', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_700_000_000_000)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const store = createZeroDevWalletStore()
    const session = {
      id: 'rejected-session',
      userId: 'user-1',
      organizationId: 'org-1',
      stamperType: 'apiKey' as const,
      token: 'jwt',
      expiry: Date.now() + 30_000,
      createdAt: Date.now(),
    }
    const wallet = {
      refreshSession: vi.fn().mockRejectedValue({ status: 401 }),
      logout: vi.fn().mockRejectedValue(new Error('backend unavailable')),
    }
    store.getState().setWallet(wallet as never)
    store.getState().setSession(session)
    store.getState().setEoaAccount(EOA_ACCOUNT)

    const provider = createProvider({
      store,
      config: { projectId: 'proj-test', chains: [sepolia] },
      chains: [sepolia],
    })
    await vi.waitFor(() => expect(wallet.logout).toHaveBeenCalledOnce())
    await Promise.resolve()

    expect(store.getState().session).toEqual(session)
    expect(store.getState().eoaAccount).toBe(EOA_ACCOUNT)
    expect(vi.getTimerCount()).toBeGreaterThan(0)
    provider.destroy()
  })

  it('does not commit a provider chain switch when setup fails', async () => {
    const store = createZeroDevWalletStore()
    store.getState().setActiveChainId(sepolia.id)
    store.getState().setEoaAccount(EOA_ACCOUNT)
    const switchChain = vi.fn().mockRejectedValue(new Error('setup failed'))
    const provider = createProvider({
      store,
      config: { projectId: 'proj-test', chains: [sepolia, mainnet] },
      chains: [sepolia, mainnet],
      switchChain,
    })

    await expect(
      provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x1' }],
      }),
    ).rejects.toThrow('setup failed')

    expect(store.getState().activeChainId).toBe(sepolia.id)
    provider.destroy()
  })

  it('rejects personal_sign for an address other than the active owner', async () => {
    const provider = createTestProvider('EOA')

    await expect(
      provider.request({
        method: 'personal_sign',
        params: ['0x1234', '0x2222222222222222222222222222222222222222'],
      }),
    ).rejects.toThrow('Invalid from address')
  })

  it('rejects eth_signTypedData_v4 for an address other than the active owner', async () => {
    const provider = createTestProvider('EOA')

    await expect(
      provider.request({
        method: 'eth_signTypedData_v4',
        // Typed-data params are [address, typedData] — address comes first.
        params: ['0x2222222222222222222222222222222222222222', '{}'],
      }),
    ).rejects.toThrow('Invalid from address')
  })
})

describe('lazy chain setup', () => {
  // Provider seeded on sepolia only; mainnet clients are built on demand via
  // the injected ensureChain (mirrors the connector's setupChain, which only
  // builds — it does not switch the active chain).
  function createLazyProvider(configChains = [sepolia, mainnet]) {
    const store = createZeroDevWalletStore()
    store.getState().setActiveChainId(sepolia.id)
    store.getState().setEoaAccount(EOA_ACCOUNT)
    const ensureChain = vi.fn(async (chainId: number) => {
      store.getState().setKernelClient(chainId, mockKernelClient)
    })
    const provider = createProvider({
      store,
      config: { projectId: 'proj-test', chains: configChains },
      chains: configChains,
      ensureChain,
    })
    return { provider, store, ensureChain }
  }

  it('builds the client on demand before wallet_sendCalls on an unconnected chain', async () => {
    sendUserOperationMock.mockResolvedValue('0xuserophash')
    const { provider, ensureChain } = createLazyProvider()

    const result = await provider.request({
      method: 'wallet_sendCalls',
      params: [
        {
          from: EOA_ADDRESS,
          chainId: `0x${mainnet.id.toString(16)}`,
          calls: [{ data: '0x' }],
        },
      ],
    })

    expect(ensureChain).toHaveBeenCalledWith(mainnet.id)
    expect(sendUserOperationMock).toHaveBeenCalledOnce()
    expect(result).toEqual({ id: `0xuserophash:${mainnet.id}` })
  })

  it('rejects wallet_sendCalls for an unconfigured chain (UnsupportedChainIdError)', async () => {
    const { provider, ensureChain } = createLazyProvider([sepolia])

    await expect(
      provider.request({
        method: 'wallet_sendCalls',
        params: [
          {
            from: EOA_ADDRESS,
            chainId: `0x${mainnet.id.toString(16)}`,
            calls: [{ data: '0x' }],
          },
        ],
      }),
    ).rejects.toMatchObject({ code: 5710 })
    expect(ensureChain).not.toHaveBeenCalled()
    expect(sendUserOperationMock).not.toHaveBeenCalled()
  })

  it('wallet_switchEthereumChain rejects an unconfigured chain with a typed error', async () => {
    const switchChain = vi.fn()
    const store = createZeroDevWalletStore()
    store.getState().setActiveChainId(sepolia.id)
    store.getState().setEoaAccount(EOA_ACCOUNT)
    const provider = createProvider({
      store,
      config: { projectId: 'proj-test', chains: [sepolia] },
      chains: [sepolia],
      switchChain,
    })

    await expect(
      provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${mainnet.id.toString(16)}` }],
      }),
    ).rejects.toMatchObject({ code: 5710 })
    expect(switchChain).not.toHaveBeenCalled()
    expect(store.getState().activeChainId).toBe(sepolia.id)
  })

  it('validates `from` against the built 4337 kernel account on a fresh chain', async () => {
    // In 4337 the expected sender is the kernel account, which only exists
    // after prepareChain() builds it. Validation must run after the build, not
    // silently pass because the account was absent at request start.
    sendUserOperationMock.mockResolvedValue('0xuserophash')
    const KERNEL_ADDRESS = `0x${'ab'.repeat(20)}` as const
    const store = createZeroDevWalletStore()
    store.getState().setActiveChainId(sepolia.id)
    store.getState().setEoaAccount(EOA_ACCOUNT)
    const ensureChain = vi.fn(async (chainId: number) => {
      store
        .getState()
        .setKernelAccount(chainId, { address: KERNEL_ADDRESS } as never)
      store.getState().setKernelClient(chainId, mockKernelClient)
    })
    const provider = createProvider({
      store,
      config: {
        projectId: 'proj-test',
        chains: [sepolia, mainnet],
        mode: '4337',
      },
      chains: [sepolia, mainnet],
      ensureChain,
    })

    // The EOA address is NOT the 4337 sender — must be rejected.
    await expect(
      provider.request({
        method: 'wallet_sendCalls',
        params: [
          {
            from: EOA_ADDRESS,
            chainId: `0x${mainnet.id.toString(16)}`,
            calls: [{ data: '0x' }],
          },
        ],
      }),
    ).rejects.toThrow('Invalid from address')
    expect(sendUserOperationMock).not.toHaveBeenCalled()

    // The kernel address (the real 4337 sender) is accepted.
    const result = await provider.request({
      method: 'wallet_sendCalls',
      params: [
        {
          from: KERNEL_ADDRESS,
          chainId: `0x${mainnet.id.toString(16)}`,
          calls: [{ data: '0x' }],
        },
      ],
    })
    expect(result).toEqual({ id: `0xuserophash:${mainnet.id}` })
  })
})
