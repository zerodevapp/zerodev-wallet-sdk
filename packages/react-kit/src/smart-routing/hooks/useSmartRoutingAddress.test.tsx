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

// Mock only the network-touching call. `createCall` and `FLEX` are pure
// helpers/constants — using the real ones keeps the test honest, otherwise
// we'd be asserting against our own mock's behavior.
vi.mock('@zerodev/smart-routing-address', async () => {
  const actual = await vi.importActual<
    typeof import('@zerodev/smart-routing-address')
  >('@zerodev/smart-routing-address')
  return {
    ...actual,
    createSmartRoutingAddress: (params: unknown) =>
      mockCreateSmartRoutingAddress(params),
  }
})

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

vi.mock('wagmi', () => ({
  useConfig: () => mockConfig,
}))

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

const baseParams = {
  owner: WALLET,
  destChain: mainnet,
  srcTokens: [{ tokenType: 'USDC' as const, chain: optimism }],
}

beforeEach(() => {
  mockCreateSmartRoutingAddress.mockReset()
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
      renderHook(() => useSmartRoutingAddress(baseParams), { wrapper }),
    ).toThrow(
      /useSmartRoutingAddress must be used with zeroDevWallet connector/,
    )
  })

  it('does not fire the query when no SRA config is set', () => {
    const store = createStore()
    mockConnector.getKitStore.mockReturnValue(store)

    const wrapper = makeWrapper()
    renderHook(() => useSmartRoutingAddress(baseParams), { wrapper })

    expect(mockCreateSmartRoutingAddress).not.toHaveBeenCalled()
  })

  it('does not fire when explicitly disabled', () => {
    const store = createStore()
    store.getState().smartRouting.initialize({ enabled: false })
    mockConnector.getKitStore.mockReturnValue(store)

    const wrapper = makeWrapper()
    renderHook(() => useSmartRoutingAddress(baseParams), { wrapper })

    expect(mockCreateSmartRoutingAddress).not.toHaveBeenCalled()
  })

  it('forwards inputs verbatim and applies the default slippage + builds actions per src tokenType', async () => {
    mockCreateSmartRoutingAddress.mockResolvedValue({
      smartRoutingAddress: '0xSRA',
      estimatedFees: [],
    })

    const store = createStore()
    store.getState().smartRouting.initialize({})
    mockConnector.getKitStore.mockReturnValue(store)

    const wrapper = makeWrapper()
    const { result } = renderHook(
      () =>
        useSmartRoutingAddress({
          owner: WALLET,
          destChain: mainnet,
          srcTokens: [
            { tokenType: 'NATIVE', chain: optimism },
            { tokenType: 'USDC', chain: optimism },
          ],
        }),
      { wrapper },
    )

    await waitFor(() => {
      expect(result.current.data?.smartRoutingAddress).toBe('0xSRA')
    })

    const args = mockCreateSmartRoutingAddress.mock.calls[0]?.[0]
    expect(args.owner).toBe(WALLET)
    expect(args.destChain.id).toBe(mainnet.id)
    expect(args.slippage).toBe(100) // hook default
    expect(args.actions).toBeDefined()
    // Actions are built per unique src tokenType.
    expect(args.actions.NATIVE).toBeDefined()
    expect(args.actions.USDC).toBeDefined()
    expect(args.actions.ERC20).toBeUndefined()
  })

  it('honors explicit slippage overrides', async () => {
    mockCreateSmartRoutingAddress.mockResolvedValue({
      smartRoutingAddress: '0xSRA',
      estimatedFees: [],
    })

    const store = createStore()
    store.getState().smartRouting.initialize({})
    mockConnector.getKitStore.mockReturnValue(store)

    const wrapper = makeWrapper()
    renderHook(
      () =>
        useSmartRoutingAddress({
          owner: WALLET,
          destChain: optimism,
          srcTokens: [{ tokenType: 'NATIVE', chain: mainnet }],
          slippage: 200,
        }),
      { wrapper },
    )

    await waitFor(() => {
      expect(mockCreateSmartRoutingAddress).toHaveBeenCalledTimes(1)
    })
    const args = mockCreateSmartRoutingAddress.mock.calls[0]?.[0]
    expect(args.destChain.id).toBe(optimism.id)
    expect(args.slippage).toBe(200)
  })
})
