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

import { DataApiError } from '../errors.js'
import {
  transactionHistoryQueryKey,
  useTransactionHistory,
} from './useTransactionHistory.js'

const baseUrl = 'https://data.example'
const connector = { id: 'zerodev-wallet' }
const config = { connectors: [connector] }

function wrapper(
  client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  }),
) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

function renderedStaleTime(query?: { staleTime: number }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  renderHook(() => useTransactionHistory({ baseUrl, query }), {
    wrapper: wrapper(client),
  })
  const [cached] = client.getQueryCache().getAll()
  return cached?.options.staleTime
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

  it('forwards chainIds to the first page and the next page', async () => {
    const chainIds = ['ethereum', 'arbitrum'] as const
    const { result } = renderHook(
      () => useTransactionHistory({ baseUrl, chainIds }),
      { wrapper: wrapper() },
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(h.getTransactionHistory.mock.calls[0]?.[1]).toMatchObject({
      chainIds,
    })

    await act(async () => {
      await result.current.fetchNextPage()
    })

    expect(h.getTransactionHistory.mock.calls[1]?.[1]).toMatchObject({
      chainIds,
      next: 'cursor-2',
    })
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

  it('defaults staleTime to 30s', () => {
    expect(renderedStaleTime()).toBe(30_000)
  })

  it("keeps the caller's staleTime", () => {
    expect(renderedStaleTime({ staleTime: 5_000 })).toBe(5_000)
  })

  it('does not refetch a fresh feed on remount', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const first = renderHook(() => useTransactionHistory({ baseUrl }), {
      wrapper: wrapper(client),
    })
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true))
    first.unmount()

    const second = renderHook(() => useTransactionHistory({ baseUrl }), {
      wrapper: wrapper(client),
    })
    await waitFor(() => expect(second.result.current.isSuccess).toBe(true))

    expect(h.getTransactionHistory).toHaveBeenCalledTimes(1)
  })

  it('does not retry a spent monthly budget on remount, focus or reconnect', async () => {
    const quota = new DataApiError({
      status: 429,
      body: { error: 'throttled', reason: 'quota_exhausted' },
      url: `${baseUrl}/v1/me/transaction-history`,
      retryAfterMs: 3_600_000,
    })
    h.getTransactionHistory.mockRejectedValue(quota)
    const client = new QueryClient()
    const first = renderHook(() => useTransactionHistory({ baseUrl }), {
      wrapper: wrapper(client),
    })
    await waitFor(() => expect(first.result.current.isError).toBe(true))
    first.unmount()

    const second = renderHook(() => useTransactionHistory({ baseUrl }), {
      wrapper: wrapper(client),
    })
    await waitFor(() => expect(second.result.current.isError).toBe(true))
    const [cached] = client.getQueryCache().getAll()
    const options = cached?.options as {
      refetchOnWindowFocus: (query: unknown) => boolean
      refetchOnReconnect: (query: unknown) => boolean
    }

    expect(h.getTransactionHistory).toHaveBeenCalledTimes(1)
    expect(options.refetchOnWindowFocus(cached)).toBe(false)
    expect(options.refetchOnReconnect(cached)).toBe(false)
  })

  it('still refetches on focus after any other error', async () => {
    h.getTransactionHistory.mockRejectedValue(
      new DataApiError({ status: 500, body: null, url: 'x' }),
    )
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const { result } = renderHook(() => useTransactionHistory({ baseUrl }), {
      wrapper: wrapper(client),
    })
    await waitFor(() => expect(result.current.isError).toBe(true))
    const [cached] = client.getQueryCache().getAll()
    const options = cached?.options as {
      refetchOnWindowFocus: (query: unknown) => boolean
    }

    expect(options.refetchOnWindowFocus(cached)).toBe(true)
  })

  it('keys the feed by URL, wallet, environment, and chainIds but not cursor', () => {
    expect(
      transactionHistoryQueryKey({
        baseUrl,
        walletAddress: '0x1111111111111111111111111111111111111111',
        environment: 'testnet',
        chainIds: ['ethereum'],
      }),
    ).toEqual([
      'zeroDev',
      'dataApi',
      'transactionHistory',
      {
        baseUrl,
        walletAddress: '0x1111111111111111111111111111111111111111',
        environment: 'testnet',
        chainIds: ['ethereum'],
      },
    ])
  })
})
