import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  getTransactionHistory: vi.fn(),
  useAccount: vi.fn(),
  useConfig: vi.fn(),
}))

vi.mock('./getTransactionHistory.js', () => ({
  getTransactionHistory: h.getTransactionHistory,
}))

vi.mock('wagmi', () => ({
  useAccount: h.useAccount,
  useConfig: h.useConfig,
}))

import {
  transactionHistoryQueryKey,
  useTransactionHistory,
} from './useTransactionHistory.js'

const baseUrl = 'https://data.example'
const connector = { id: 'zerodev-wallet' }
const config = { connectors: [connector] }

function wrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

describe('useTransactionHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h.useConfig.mockReturnValue(config)
    h.useAccount.mockReturnValue({
      status: 'connected',
      address: '0x1111111111111111111111111111111111111111',
      connector,
    })
    h.getTransactionHistory.mockImplementation(
      async (_config: unknown, parameters: { next?: string }) =>
        parameters.next === undefined
          ? { items: [], next: 'cursor-2' }
          : { items: [] },
    )
  })

  it('keeps the query idle until the ZeroDev account is connected', () => {
    h.useAccount.mockReturnValue({
      status: 'reconnecting',
      address: undefined,
      connector,
    })

    const { result } = renderHook(() => useTransactionHistory({ baseUrl }), {
      wrapper: wrapper(),
    })

    expect(result.current.fetchStatus).toBe('idle')
    expect(h.getTransactionHistory).not.toHaveBeenCalled()
  })

  it('defaults to mainnet and appends the opaque next page', async () => {
    const { result } = renderHook(() => useTransactionHistory({ baseUrl }), {
      wrapper: wrapper(),
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(h.getTransactionHistory.mock.calls[0]?.[1]).toMatchObject({
      baseUrl,
      connector,
      environment: 'mainnet',
    })
    expect(h.getTransactionHistory.mock.calls[0]?.[1].next).toBeUndefined()
    expect(h.getTransactionHistory.mock.calls[0]?.[1].signal).toBeInstanceOf(
      AbortSignal,
    )

    let nextResult:
      | Awaited<ReturnType<typeof result.current.fetchNextPage>>
      | undefined
    await act(async () => {
      nextResult = await result.current.fetchNextPage()
    })

    expect(h.getTransactionHistory).toHaveBeenCalledTimes(2)
    expect(h.getTransactionHistory.mock.calls[1]?.[1]).toMatchObject({
      baseUrl,
      next: 'cursor-2',
      environment: 'mainnet',
    })
    expect(nextResult?.data?.pages).toEqual([
      { items: [], next: 'cursor-2' },
      { items: [] },
    ])
    expect(nextResult?.hasNextPage).toBe(false)
  })

  it('passes an explicit testnet environment', async () => {
    renderHook(
      () => useTransactionHistory({ baseUrl, environment: 'testnet' }),
      { wrapper: wrapper() },
    )

    await waitFor(() => expect(h.getTransactionHistory).toHaveBeenCalled())
    expect(h.getTransactionHistory.mock.calls[0]?.[1]).toMatchObject({
      baseUrl,
      environment: 'testnet',
    })
  })

  it('does not query when another connector is active', () => {
    h.useAccount.mockReturnValue({
      status: 'connected',
      address: '0x2222222222222222222222222222222222222222',
      connector: { id: 'other-wallet' },
    })

    const { result } = renderHook(() => useTransactionHistory({ baseUrl }), {
      wrapper: wrapper(),
    })

    expect(result.current.fetchStatus).toBe('idle')
    expect(h.getTransactionHistory).not.toHaveBeenCalled()
  })

  it('keys the feed by URL, wallet, and environment but not cursor', () => {
    expect(
      transactionHistoryQueryKey({
        baseUrl,
        walletAddress: '0x1111111111111111111111111111111111111111',
        environment: 'testnet',
      }),
    ).toEqual([
      'zeroDev',
      'dataApi',
      'transactionHistory',
      {
        baseUrl,
        walletAddress: '0x1111111111111111111111111111111111111111',
        environment: 'testnet',
      },
    ])
  })
})
