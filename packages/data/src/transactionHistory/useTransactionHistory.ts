'use client'

import {
  type InfiniteData,
  type UseInfiniteQueryOptions,
  type UseInfiniteQueryResult,
  useInfiniteQuery,
} from '@tanstack/react-query'
import type {
  DataApiChainId,
  TransactionHistoryResponse,
} from '@zerodev/data-api-contract'
import type { DataApiEnvironment } from '@zerodev/data-api-stamp'
import { NotAuthenticatedError } from '@zerodev/wallet-react'
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

  return useInfiniteQuery({
    ...query,
    queryKey: transactionHistoryQueryKey({
      baseUrl,
      walletAddress: connector && accountReady ? account.address : null,
      environment,
      chainIds,
    }),
    initialPageParam: null,
    queryFn: ({ pageParam, signal }) => {
      if (!connector) throw new NotAuthenticatedError()
      return getTransactionHistory(config, {
        baseUrl,
        connector,
        environment,
        ...(chainIds === undefined ? {} : { chainIds }),
        ...(pageParam === null ? {} : { next: pageParam }),
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

  type ReturnType = UseInfiniteQueryResult<QueryData, Error>
}
