'use client'

import {
  type InfiniteData,
  type QueryObserverResult,
  type UseInfiniteQueryOptions,
  type UseInfiniteQueryResult,
  useInfiniteQuery,
  useQueryClient,
} from '@tanstack/react-query'
import type {
  DataApiChainId,
  TransactionHistoryResponse,
} from '@zerodev/data-api-contract'
import type { DataApiEnvironment } from '@zerodev/data-api-stamp'
import { NotAuthenticatedError } from '@zerodev/wallet-react'
import { useCallback, useEffect, useRef } from 'react'
import {
  type Config,
  type ResolvedRegister,
  useAccount,
  useConfig,
} from 'wagmi'
import { getTransactionHistory } from './getTransactionHistory.js'
import {
  isQuotaExhaustedError,
  transactionHistoryRetry,
  transactionHistoryRetryDelay,
} from './query.js'

type ConfigParameter<config extends Config = Config> = {
  config?: Config | config | undefined
}

type PageParam = string | null
type QueryKey = ReturnType<typeof transactionHistoryQueryKey>
type QueryData = InfiniteData<TransactionHistoryResponse, PageParam>

const WAIT_FOR_TRANSACTION_DELAYS_MS = [
  2_000, 3_000, 5_000, 8_000, 13_000, 20_000,
]

export function transactionHistoryQueryKey(input: {
  baseUrl: string
  walletAddress: string | null
  environment: DataApiEnvironment
  chainIds?: readonly DataApiChainId[] | undefined
}) {
  return ['zeroDev', 'dataApi', 'transactionHistory', input] as const
}

export function useTransactionHistory<
  config extends Config = ResolvedRegister['config'],
>(
  parameters: useTransactionHistory.Parameters<config>,
): useTransactionHistory.ReturnType {
  const { baseUrl, chainIds, query } = parameters
  const config = useConfig(parameters)
  // Wagmi 2 does not export useConnection. Wagmi 3 keeps useAccount as its
  // deprecated compatibility alias, so useAccount supports both peer majors.
  const account = useAccount({ config })
  const environment = parameters.environment ?? 'mainnet'
  const connector =
    account.connector?.id === 'zerodev-wallet' ? account.connector : undefined
  const accountReady =
    account.status === 'connected' && account.address !== undefined
  const queryClient = useQueryClient()
  const queryKey = transactionHistoryQueryKey({
    baseUrl,
    walletAddress: connector && accountReady ? account.address : null,
    environment,
    chainIds,
  })
  const latestQueryKey = useRef(queryKey)
  useEffect(() => {
    latestQueryKey.current = queryKey
  })
  const freshRequests = useRef(0)
  const lifetime = useRef<AbortController | null>(null)
  useEffect(() => {
    const controller =
      lifetime.current?.signal.aborted === false
        ? lifetime.current
        : new AbortController()
    lifetime.current = controller
    return () => controller.abort()
  }, [])

  const result = useInfiniteQuery({
    ...query,
    queryKey,
    initialPageParam: null,
    queryFn: ({ pageParam, signal }) => {
      if (!connector) throw new NotAuthenticatedError()
      return getTransactionHistory(config, {
        baseUrl,
        connector,
        environment,
        ...(chainIds === undefined ? {} : { chainIds }),
        ...(pageParam === null
          ? { fresh: freshRequests.current > 0 }
          : { next: pageParam }),
        signal,
      })
    },
    getNextPageParam: (lastPage) => lastPage.next ?? undefined,
    enabled: Boolean(connector) && accountReady && (query?.enabled ?? true),
    // TanStack's default of 0 refetches every loaded page on mount, focus and
    // reconnect.
    staleTime: query?.staleTime ?? 30_000,
    // staleTime only holds a query that has data. After a first load that hit the
    // monthly budget there is none, so without these every mount and focus would
    // send another refused request until the next UTC month.
    retryOnMount: query?.retryOnMount ?? notQuotaExhausted,
    refetchOnWindowFocus: query?.refetchOnWindowFocus ?? notQuotaExhausted,
    refetchOnReconnect: query?.refetchOnReconnect ?? notQuotaExhausted,
    retry: query?.retry ?? transactionHistoryRetry,
    retryDelay: query?.retryDelay ?? transactionHistoryRetryDelay,
  })

  const refresh = useCallback(async () => {
    freshRequests.current++
    try {
      return await result.refetch()
    } finally {
      freshRequests.current--
    }
  }, [result.refetch])

  const waitForTransaction = useCallback(
    async (txHash: string) => {
      const hash = txHash.toLowerCase()
      const cached = queryClient.getQueryData<QueryData>(latestQueryKey.current)
      if (hasTransaction(cached, hash)) return true

      // A child's mount effect runs before this hook's, so it can call in
      // before the effect above has created the controller.
      lifetime.current ??= new AbortController()
      const { signal } = lifetime.current
      for (const delay of WAIT_FOR_TRANSACTION_DELAYS_MS) {
        await sleep(delay, signal)
        if (signal.aborted) return false
        const { data, error } = await refresh()
        if (signal.aborted) return false
        if (hasTransaction(data, hash)) return true
        if (isQuotaExhaustedError(error)) return false
      }
      return false
    },
    [queryClient, refresh],
  )

  // Spreading `result` would read every tracked property and subscribe the
  // component to all of them.
  return Object.assign(result, { refresh, waitForTransaction })
}

function hasTransaction(data: QueryData | undefined, hash: string): boolean {
  return (
    data?.pages.some((page) =>
      page.items.some((item) => item.txHash.toLowerCase() === hash),
    ) ?? false
  )
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve()
    const timer = setTimeout(done, ms)
    signal.addEventListener('abort', done, { once: true })
    function done() {
      clearTimeout(timer)
      signal.removeEventListener('abort', done)
      resolve()
    }
  })
}

function notQuotaExhausted(query: { state: { error: unknown } }): boolean {
  return !isQuotaExhaustedError(query.state.error)
}

export declare namespace useTransactionHistory {
  type Parameters<config extends Config = Config> = ConfigParameter<config> & {
    baseUrl: string
    chainIds?: readonly DataApiChainId[]
    environment?: DataApiEnvironment
    query?:
      | Omit<
          UseInfiniteQueryOptions<
            TransactionHistoryResponse,
            Error,
            QueryData,
            QueryKey,
            PageParam
          >,
          'queryKey' | 'queryFn' | 'initialPageParam' | 'getNextPageParam'
        >
      | undefined
  }

  type ReturnType = UseInfiniteQueryResult<QueryData, Error> & {
    /**
     * Refetch every loaded page, fetching page 1 past the server cache. Spends
     * one lookup from the monthly budget.
     */
    refresh: () => Promise<QueryObserverResult<QueryData, Error>>
    /**
     * Resolve `true` once `txHash` is in a loaded page. Checks the loaded pages
     * first, then refreshes at most 6 times over about 51 s. Resolves `false`
     * on timeout, unmount, or a spent monthly budget.
     */
    waitForTransaction: (txHash: string) => Promise<boolean>
  }
}
