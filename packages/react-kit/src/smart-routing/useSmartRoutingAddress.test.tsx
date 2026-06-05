/**
 * @vitest-environment happy-dom
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { mainnet, optimism } from 'viem/chains'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createStore } from '../store'
import { useSmartRoutingAddress } from './useSmartRoutingAddress'

const mockCreateSmartRoutingAddress = vi.fn()
const mockCreateCall = vi.fn((args) => ({ __call: args }))

vi.mock('@zerodev/smart-routing-address', () => ({
  createSmartRoutingAddress: (params: unknown) =>
    mockCreateSmartRoutingAddress(params),
  createCall: (args: unknown) => mockCreateCall(args),
  FLEX: {
    TOKEN_ADDRESS: 'TOKEN_ADDRESS',
    AMOUNT: 'AMOUNT',
    NATIVE_AMOUNT: 'NATIVE_AMOUNT',
  },
}))

const WALLET = '0x1111111111111111111111111111111111111111' as const

const mockConnector = {
  id: 'zerodev-wallet',
  getKitStore: vi.fn(),
}
const mockConfig = {
  connectors: [mockConnector] as Array<{
    id: string
    getKitStore?: () => unknown
  }>,
}
let mockChainId = mainnet.id
const mockChains = [mainnet, optimism]
const mockAccount = { address: WALLET as `0x${string}` | undefined }

vi.mock('wagmi', () => ({
  useConfig: () => mockConfig,
  useAccount: () => mockAccount,
  useChainId: () => mockChainId,
  useChains: () => mockChains,
}))

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

beforeEach(() => {
  mockCreateSmartRoutingAddress.mockReset()
  mockCreateCall.mockClear()
  mockChainId = mainnet.id
  mockAccount.address = WALLET
  mockConfig.connectors = [mockConnector]
  mockConnector.getKitStore.mockReset()
})

afterEach(() => {
  cleanup()
})

describe('useSmartRoutingAddress', () => {
  it('throws when used outside the kit connector', () => {
    mockConfig.connectors = []
    const wrapper = makeWrapper()
    expect(() =>
      renderHook(() => useSmartRoutingAddress(), { wrapper }),
    ).toThrow(
      /useSmartRoutingAddress must be used with zeroDevWallet connector/,
    )
  })

  it('does not fire the query when no SRA config is set', () => {
    const store = createStore()
    mockConnector.getKitStore.mockReturnValue(store)

    const wrapper = makeWrapper()
    renderHook(
      () =>
        useSmartRoutingAddress({
          srcTokens: [{ tokenType: 'ERC20', chain: optimism }],
        }),
      { wrapper },
    )

    expect(mockCreateSmartRoutingAddress).not.toHaveBeenCalled()
  })

  it('does not fire when explicitly disabled', () => {
    const store = createStore()
    store.getState().smartRouting.initialize({ enabled: false })
    mockConnector.getKitStore.mockReturnValue(store)

    const wrapper = makeWrapper()
    renderHook(
      () =>
        useSmartRoutingAddress({
          srcTokens: [{ tokenType: 'ERC20', chain: optimism }],
        }),
      { wrapper },
    )

    expect(mockCreateSmartRoutingAddress).not.toHaveBeenCalled()
  })

  it('does not fire when srcTokens is empty', () => {
    const store = createStore()
    store.getState().smartRouting.initialize({})
    mockConnector.getKitStore.mockReturnValue(store)

    const wrapper = makeWrapper()
    renderHook(() => useSmartRoutingAddress({ srcTokens: [] }), { wrapper })

    expect(mockCreateSmartRoutingAddress).not.toHaveBeenCalled()
  })

  it('computes the SRA with connector defaults (owner, destChain, slippage, actions)', async () => {
    mockCreateSmartRoutingAddress.mockResolvedValue({
      smartRoutingAddress: '0xSRA',
      estimatedFees: [],
    })

    const store = createStore()
    store.getState().smartRouting.initialize({}) // no overrides; defaults take over
    mockConnector.getKitStore.mockReturnValue(store)

    const wrapper = makeWrapper()
    const { result } = renderHook(
      () =>
        useSmartRoutingAddress({
          srcTokens: [{ tokenType: 'ERC20', chain: optimism }],
        }),
      { wrapper },
    )

    await waitFor(() => {
      expect(result.current.data?.smartRoutingAddress).toBe('0xSRA')
    })

    const args = mockCreateSmartRoutingAddress.mock.calls[0]?.[0]
    expect(args.owner).toBe(WALLET)
    expect(args.destChain.id).toBe(mainnet.id) // matches useChainId default
    expect(args.slippage).toBe(100) // default 1%
    expect(args.actions).toBeDefined()
    expect(args.actions.NATIVE).toBeDefined()
    expect(args.actions.ERC20).toBeDefined()
  })

  it('uses the first destinationChains entry from connector config as destChain', async () => {
    mockCreateSmartRoutingAddress.mockResolvedValue({
      smartRoutingAddress: '0xSRA',
      estimatedFees: [],
    })

    const store = createStore()
    store
      .getState()
      .smartRouting.initialize({ destinationChains: [optimism, mainnet] })
    mockConnector.getKitStore.mockReturnValue(store)

    const wrapper = makeWrapper()
    renderHook(
      () =>
        useSmartRoutingAddress({
          srcTokens: [{ tokenType: 'ERC20', chain: mainnet }],
        }),
      { wrapper },
    )

    await waitFor(() => {
      expect(mockCreateSmartRoutingAddress).toHaveBeenCalledTimes(1)
    })
    const args = mockCreateSmartRoutingAddress.mock.calls[0]?.[0]
    expect(args.destChain.id).toBe(optimism.id)
  })

  it('per-call overrides win over connector config defaults', async () => {
    mockCreateSmartRoutingAddress.mockResolvedValue({
      smartRoutingAddress: '0xSRA',
      estimatedFees: [],
    })

    const store = createStore()
    store.getState().smartRouting.initialize({
      maxSlippage: 50,
      destinationChains: [mainnet],
    })
    mockConnector.getKitStore.mockReturnValue(store)

    const wrapper = makeWrapper()
    const customOwner = '0x2222222222222222222222222222222222222222' as const
    renderHook(
      () =>
        useSmartRoutingAddress({
          owner: customOwner,
          destChain: optimism,
          maxSlippage: 200,
          srcTokens: [{ tokenType: 'NATIVE', chain: mainnet }],
        }),
      { wrapper },
    )

    await waitFor(() => {
      expect(mockCreateSmartRoutingAddress).toHaveBeenCalledTimes(1)
    })
    const args = mockCreateSmartRoutingAddress.mock.calls[0]?.[0]
    expect(args.owner).toBe(customOwner)
    expect(args.destChain.id).toBe(optimism.id)
    expect(args.slippage).toBe(200)
  })

  it('does not fire when no wallet is connected', () => {
    mockAccount.address = undefined

    const store = createStore()
    store.getState().smartRouting.initialize({})
    mockConnector.getKitStore.mockReturnValue(store)

    const wrapper = makeWrapper()
    renderHook(
      () =>
        useSmartRoutingAddress({
          srcTokens: [{ tokenType: 'ERC20', chain: optimism }],
        }),
      { wrapper },
    )

    expect(mockCreateSmartRoutingAddress).not.toHaveBeenCalled()
  })
})
