import type { IconName } from '@zerodev/react-ui'
import type {
  TransactionHistoryChain,
  TransactionHistoryTransaction,
} from '@zerodev/wallet-data'

export type TxHistoryStatus = 'Pending' | 'Success' | 'Failed' | 'Unknown'

export interface TxHistoryEntry {
  id: string
  icon: IconName
  title: string
  /** Absent when the transaction moved no asset (deploy, execute, unparsed). */
  value?: string
  chain: Pick<TransactionHistoryChain, 'name' | 'iconUri'>
  status: TxHistoryStatus
  /** Unix epoch milliseconds. */
  timestamp: number
  /** Absent for `kind: 'unparsed'` placeholders, which are inert rows. */
  transaction?: TransactionHistoryTransaction
}

export type HistoryFeed =
  | { status: 'loading' }
  | { status: 'error'; error: Error; retry: () => void }
  | {
      status: 'ready'
      entries: TxHistoryEntry[]
      hasMore: boolean
      loadingMore: boolean
      loadMore: () => void
    }
