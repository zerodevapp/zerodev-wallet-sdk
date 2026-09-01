'use client'

import {
  type InfiniteData,
  type UseInfiniteQueryOptions,
  type UseInfiniteQueryResult,
  useInfiniteQuery,
} from '@tanstack/react-query'
import type { TransactionHistoryResponse } from '@zerodev/data-api-contract'
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
}) {
  return ['zeroDev', 'dataApi', 'transactionHistory', input] as const
}

export function useTransactionHistory<
  config extends Config = ResolvedRegister['config'],
>(
  parameters: useTransactionHistory.Parameters<config>,
): useTransactionHistory.ReturnType {
  const { baseUrl, query } = parameters
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
    }),
    initialPageParam: null,
    queryFn: ({ pageParam, signal }) => {
      if (!connector) throw new NotAuthenticatedError()
      return getTransactionHistory(config, {
        baseUrl,
        connector,
        environment,
        ...(pageParam === null ? {} : { next: pageParam }),
        signal,
      })
    },
    getNextPageParam: (lastPage) => lastPage.next ?? undefined,
    enabled: Boolean(connector) && accountReady && (query?.enabled ?? true),
    retry: query?.retry ?? transactionHistoryRetry,
    retryDelay: query?.retryDelay ?? transactionHistoryRetryDelay,
  })
}

export declare namespace useTransactionHistory {
  type Parameters<config extends Config = Config> = ConfigParameter<config> & {
    baseUrl: string
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
