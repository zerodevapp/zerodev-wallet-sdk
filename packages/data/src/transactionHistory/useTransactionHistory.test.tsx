import {
  focusManager,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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

type Parameters = { next?: string; fresh?: boolean }

function requests(): Parameters[] {
  return h.getTransactionHistory.mock.calls.map(([, parameters]) => parameters)
}

function firstPageRequests(): Parameters[] {
  return requests().filter((parameters) => parameters.next === undefined)
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
  afterEach(() => {
    vi.useRealTimers()
    focusManager.setFocused(undefined)
  })

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

  it('never asks for fresh on load, next page, focus, remount or after staleTime', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const first = renderHook(() => useTransactionHistory({ baseUrl }), {
      wrapper: wrapper(client),
    })
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true))
    await act(async () => {
      await first.result.current.fetchNextPage()
    })
    vi.useFakeTimers({ now: Date.now() })

    await act(async () => {
      focusManager.setFocused(false)
      focusManager.setFocused(true)
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(h.getTransactionHistory).toHaveBeenCalledTimes(2)

    await act(() => vi.advanceTimersByTimeAsync(30_001))
    await act(async () => {
      focusManager.setFocused(false)
      focusManager.setFocused(true)
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(h.getTransactionHistory).toHaveBeenCalledTimes(4)

    first.unmount()
    await act(() => vi.advanceTimersByTimeAsync(30_001))
    renderHook(() => useTransactionHistory({ baseUrl }), {
      wrapper: wrapper(client),
    })
    await act(() => vi.advanceTimersByTimeAsync(0))

    expect(h.getTransactionHistory).toHaveBeenCalledTimes(6)
    expect(firstPageRequests()).toHaveLength(3)
    for (const parameters of firstPageRequests()) {
      expect(parameters.fresh).toBe(false)
    }
    for (const parameters of requests()) {
      expect(parameters.fresh).not.toBe(true)
    }
  })

  it('refreshes every loaded page under the same key, page 1 fresh', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const { result } = renderHook(() => useTransactionHistory({ baseUrl }), {
      wrapper: wrapper(client),
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    await act(async () => {
      await result.current.fetchNextPage()
    })

    let refreshed:
      | Awaited<ReturnType<typeof result.current.refresh>>
      | undefined
    await act(async () => {
      refreshed = await result.current.refresh()
    })

    expect(requests().slice(2)).toEqual([
      expect.objectContaining({ fresh: true }),
      expect.objectContaining({ next: 'cursor-2' }),
    ])
    expect(requests()[2]?.next).toBeUndefined()
    expect(requests()[3]).not.toHaveProperty('fresh')
    expect(refreshed?.data?.pages).toHaveLength(2)
    expect(client.getQueryCache().getAll()).toHaveLength(1)
  })

  it("does not send fresh for another instance's refetch during a refresh", async () => {
    h.getTransactionHistory.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
      return { items: [] }
    })
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const a = renderHook(() => useTransactionHistory({ baseUrl }), {
      wrapper: wrapper(client),
    })
    const b = renderHook(() => useTransactionHistory({ baseUrl }), {
      wrapper: wrapper(client),
    })
    await waitFor(() => expect(a.result.current.isSuccess).toBe(true))
    h.getTransactionHistory.mockClear()

    let refreshing: Promise<unknown> | undefined
    act(() => {
      refreshing = a.result.current.refresh()
    })
    await waitFor(() => expect(h.getTransactionHistory).toHaveBeenCalled())
    await act(async () => {
      await b.result.current.refetch()
      await refreshing
    })

    expect(requests().map((parameters) => parameters.fresh)).toEqual([
      true,
      false,
    ])
  })

  describe('waitForTransaction', () => {
    const HASH =
      '0xAbCdEf0000000000000000000000000000000000000000000000000000000001'
    const OTHER =
      '0x2222222222222222222222222222222222222222222222222222222222222222'

    async function loadThenFakeTimers() {
      const rendered = renderHook(() => useTransactionHistory({ baseUrl }), {
        wrapper: wrapper(),
      })
      await waitFor(() => expect(rendered.result.current.isSuccess).toBe(true))
      vi.useFakeTimers()
      return rendered
    }

    function firstPagesFrom(...pages: { txHash: string }[][]) {
      let call = 0
      h.getTransactionHistory.mockImplementation(
        async (_config: unknown, parameters: Parameters) => {
          if (parameters.next !== undefined) return { items: [] }
          const items = pages[Math.min(call, pages.length - 1)] ?? []
          call++
          return { items }
        },
      )
    }

    it('resolves true from a loaded later page without a request', async () => {
      h.getTransactionHistory.mockImplementation(
        async (_config: unknown, parameters: Parameters) =>
          parameters.next === undefined
            ? { items: [{ txHash: OTHER }], next: 'cursor-2' }
            : { items: [{ txHash: HASH }] },
      )
      const { result } = await loadThenFakeTimers()
      vi.useRealTimers()
      await act(async () => {
        await result.current.fetchNextPage()
      })

      await expect(
        result.current.waitForTransaction(HASH.toLowerCase()),
      ).resolves.toBe(true)
      expect(h.getTransactionHistory).toHaveBeenCalledTimes(2)
    })

    it('polls with fresh until the hash appears', async () => {
      firstPagesFrom([], [], [], [{ txHash: HASH }])
      const { result } = await loadThenFakeTimers()

      const waiting = result.current.waitForTransaction(HASH)
      await act(() => vi.advanceTimersByTimeAsync(2_000 + 3_000 + 5_000))

      await expect(waiting).resolves.toBe(true)
      expect(firstPageRequests().slice(1)).toEqual([
        expect.objectContaining({ fresh: true }),
        expect.objectContaining({ fresh: true }),
        expect.objectContaining({ fresh: true }),
      ])
      expect(h.getTransactionHistory).toHaveBeenCalledTimes(4)
    })

    it('resolves false after six polls', async () => {
      firstPagesFrom([])
      const { result } = await loadThenFakeTimers()

      const waiting = result.current.waitForTransaction(HASH)
      await act(() => vi.advanceTimersByTimeAsync(50_999))
      expect(h.getTransactionHistory).toHaveBeenCalledTimes(6)
      await act(() => vi.advanceTimersByTimeAsync(1))

      await expect(waiting).resolves.toBe(false)
      expect(h.getTransactionHistory).toHaveBeenCalledTimes(7)
      await act(() => vi.advanceTimersByTimeAsync(60_000))
      expect(h.getTransactionHistory).toHaveBeenCalledTimes(7)
    })

    it('stops on a spent monthly budget', async () => {
      firstPagesFrom([])
      const { result } = await loadThenFakeTimers()
      h.getTransactionHistory.mockRejectedValue(
        new DataApiError({
          status: 429,
          body: { error: 'rate_limited', reason: 'quota_exhausted' },
          url: `${baseUrl}/v1/me/transaction-history`,
          retryAfterMs: 3_600_000,
        }),
      )

      const waiting = result.current.waitForTransaction(HASH)
      await act(() => vi.advanceTimersByTimeAsync(2_000))

      await expect(waiting).resolves.toBe(false)
      await act(() => vi.advanceTimersByTimeAsync(60_000))
      expect(h.getTransactionHistory).toHaveBeenCalledTimes(2)
    })

    it('resolves false on unmount and stops polling', async () => {
      firstPagesFrom([])
      const { result, unmount } = await loadThenFakeTimers()

      const waiting = result.current.waitForTransaction(HASH)
      await act(() => vi.advanceTimersByTimeAsync(2_000))
      expect(h.getTransactionHistory).toHaveBeenCalledTimes(2)
      unmount()

      await expect(waiting).resolves.toBe(false)
      await act(() => vi.advanceTimersByTimeAsync(60_000))
      expect(h.getTransactionHistory).toHaveBeenCalledTimes(2)
    })

    it('resolves false on an aborted signal and stops polling', async () => {
      firstPagesFrom([])
      const { result } = await loadThenFakeTimers()
      const controller = new AbortController()

      const waiting = result.current.waitForTransaction(HASH, {
        signal: controller.signal,
      })
      await act(() => vi.advanceTimersByTimeAsync(2_000))
      expect(h.getTransactionHistory).toHaveBeenCalledTimes(2)
      controller.abort()

      await expect(waiting).resolves.toBe(false)
      await act(() => vi.advanceTimersByTimeAsync(60_000))
      expect(h.getTransactionHistory).toHaveBeenCalledTimes(2)
    })

    it('keeps other waits polling when one signal aborts', async () => {
      firstPagesFrom([], [], [{ txHash: OTHER }])
      const { result } = await loadThenFakeTimers()
      const controller = new AbortController()

      const aborted = result.current.waitForTransaction(HASH, {
        signal: controller.signal,
      })
      const other = result.current.waitForTransaction(OTHER)
      controller.abort()
      await act(() => vi.advanceTimersByTimeAsync(2_000 + 3_000))

      await expect(aborted).resolves.toBe(false)
      await expect(other).resolves.toBe(true)
    })

    it('resolves overlapping waits', async () => {
      firstPagesFrom([], [], [{ txHash: HASH }, { txHash: OTHER }])
      const { result } = await loadThenFakeTimers()

      const first = result.current.waitForTransaction(HASH)
      await act(() => vi.advanceTimersByTimeAsync(1_000))
      const second = result.current.waitForTransaction(OTHER)
      await act(() => vi.advanceTimersByTimeAsync(5_000))

      await expect(Promise.all([first, second])).resolves.toEqual([true, true])
    })
  })
})
