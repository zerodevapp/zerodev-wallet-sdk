import {
  type DataApiChainId,
  type DataApiEnvironment,
  isQuotaExhaustedError,
  useTransactionHistory,
} from '@zerodev/wallet-data'
import { useEffect, useMemo, useState } from 'react'
import { equalsIgnoreCase } from '../../shared/utils/common'
import type { HistoryFeed, PendingTransaction, TxHistoryEntry } from '../types'
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
  /** On-chain hash of a transaction the app just sent (not a UserOperation
   * hash or a `wallet_sendCalls` id). The widget shows a placeholder and
   * polls until the list has it; polling runs only while the widget is
   * mounted. */
  pendingTxHash?: string
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
  pendingTxHash,
}: TxHistoryProps) {
  const history = useTransactionHistory(dataApi)

  const entries = useMemo(
    () =>
      (history.data?.pages ?? [])
        .flatMap((page) => page.items)
        .flatMap((item) => toTxHistoryEntry(item) ?? []),
    [history.data],
  )

  const pending = usePendingTransaction(
    history.waitForTransaction,
    entries,
    pendingTxHash,
  )
  const feed = toFeed(history, entries, pending)

  return (
    <TxHistoryView
      feed={feed}
      onClose={onClose}
      {...(className && { className })}
      {...(size && { size })}
    />
  )
}

/** Found is read from the loaded entries rather than from the wait's
 * result, so a manual refresh after the wait gave up still finds it. */
function usePendingTransaction(
  waitForTransaction: ReturnType<
    typeof useTransactionHistory
  >['waitForTransaction'],
  entries: TxHistoryEntry[],
  txHash: string | undefined,
): PendingTransaction | undefined {
  const [stoppedHash, setStoppedHash] = useState<string>()
  useEffect(() => {
    if (!txHash) return
    const controller = new AbortController()
    waitForTransaction(txHash, { signal: controller.signal }).then(() => {
      if (!controller.signal.aborted) setStoppedHash(txHash)
    })
    return () => controller.abort()
  }, [txHash, waitForTransaction])

  if (!txHash) return undefined
  if (entries.some((entry) => equalsIgnoreCase(entry.txHash, txHash))) {
    return { txHash, state: 'found' }
  }
  return { txHash, state: stoppedHash === txHash ? 'stopped' : 'polling' }
}

function toFeed(
  history: ReturnType<typeof useTransactionHistory>,
  entries: TxHistoryEntry[],
  pending: PendingTransaction | undefined,
): HistoryFeed {
  if (history.status === 'pending') return { status: 'loading' }
  // TanStack reports a failed fetchNextPage or refetch as status 'error' but
  // keeps the loaded pages, so the list stays and the error shows inline.
  if (
    history.status === 'error' &&
    !history.isFetchNextPageError &&
    !history.isRefetchError
  ) {
    return {
      status: 'error',
      error: history.error,
      retry: () => {
        history.refetch()
      },
    }
  }
  const updatedAt = history.data.pages[0]?.cache?.fetchedAt
  return {
    status: 'ready',
    entries,
    hasMore: history.isFetchNextPageError || history.hasNextPage,
    loadingMore: history.isFetchingNextPage,
    loadMore: () => {
      history.fetchNextPage()
    },
    ...(history.isFetchNextPageError && { loadMoreError: history.error }),
    refreshing: history.isRefetching,
    refresh: () => {
      history.refresh()
    },
    ...(history.isRefetchError && { refreshError: history.error }),
    ...(updatedAt !== undefined && { updatedAt }),
    // A spent budget ends polling; the refresh line says why.
    ...(pending &&
      !isQuotaExhaustedError(history.error) && { pendingTransaction: pending }),
  }
}
