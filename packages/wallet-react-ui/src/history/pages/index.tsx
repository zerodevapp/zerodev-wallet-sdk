import {
  type DataApiChainId,
  type DataApiEnvironment,
  useTransactionHistory,
} from '@zerodev/wallet-data'
import { useMemo } from 'react'
import type { HistoryFeed, TxHistoryEntry } from '../types'
import { toTxHistoryEntry } from '../utils/toTxHistoryEntry'
import { TxHistoryView } from './TxHistoryView'

export interface TxHistoryProps {
  dataApi: {
    baseUrl: string
    environment?: DataApiEnvironment
    chainIds?: readonly DataApiChainId[]
  }
  onClose: () => void
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

/**
 * Transaction history widget. Fetches the connected ZeroDev wallet's
 * history from the Data API and stays in its loading state until the
 * wallet is connected.
 */
export function TxHistory({
  dataApi,
  onClose,
  className,
  size,
}: TxHistoryProps) {
  const history = useTransactionHistory(dataApi)

  const entries = useMemo(
    () =>
      (history.data?.pages ?? [])
        .flatMap((page) => page.items)
        .flatMap((item) => toTxHistoryEntry(item) ?? []),
    [history.data],
  )

  const feed = toFeed(history, entries)

  return (
    <TxHistoryView
      feed={feed}
      onClose={onClose}
      {...(className && { className })}
      {...(size && { size })}
    />
  )
}

function toFeed(
  history: ReturnType<typeof useTransactionHistory>,
  entries: TxHistoryEntry[],
): HistoryFeed {
  if (history.status === 'pending') return { status: 'loading' }
  if (history.status === 'error' && !history.isFetchNextPageError) {
    return {
      status: 'error',
      error: history.error,
      retry: () => {
        history.refetch()
      },
    }
  }
  // TanStack reports a failed fetchNextPage as status 'error' but keeps the
  // loaded pages, so the list stays and the error shows inline.
  return {
    status: 'ready',
    entries,
    hasMore: history.status === 'error' || history.hasNextPage,
    loadingMore: history.isFetchingNextPage,
    loadMore: () => {
      history.fetchNextPage()
    },
    ...(history.status === 'error' && { loadMoreError: history.error }),
  }
}
