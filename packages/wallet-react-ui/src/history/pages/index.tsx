import { Screen, TopNav } from '@zerodev/react-ui'
import {
  type DataApiChainId,
  type DataApiEnvironment,
  useTransactionHistory,
} from '@zerodev/wallet-data'
import { useMemo } from 'react'
import type { HistoryFeed } from '../types'
import { toTxHistoryEntry } from '../utils/toTxHistoryEntry'
import { History } from './History'

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

  const feed: HistoryFeed =
    history.status === 'pending'
      ? { status: 'loading' }
      : history.status === 'error'
        ? {
            status: 'error',
            error: history.error,
            retry: () => {
              history.refetch()
            },
          }
        : {
            status: 'ready',
            entries,
            hasMore: history.hasNextPage,
            loadingMore: history.isFetchingNextPage,
            loadMore: () => {
              history.fetchNextPage()
            },
          }

  return (
    <Screen
      {...(className && { className })}
      {...(size && { size })}
      topNav={<TopNav title="History" onRightButtonClick={onClose} />}
    >
      <History feed={feed} />
    </Screen>
  )
}
