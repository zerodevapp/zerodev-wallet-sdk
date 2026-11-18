import type { IconName } from '@zerodev/react-ui'
import type {
  TransactionHistoryChain,
  TransactionHistoryTransaction,
} from '@zerodev/wallet-data'

export type TxHistoryStatus = 'Pending' | 'Success' | 'Failed' | 'Unknown'

export interface TxHistoryEntry {
  id: string
  /** Matches the entry to a pending transaction hash. */
  txHash: string
  icon: IconName
  title: string
  /** Absent when the transaction moved no asset (deploy, execute, unparsed). */
  value?: string
  /** The token unit `value` ends with. The row keeps it visible when the
   * value truncates. Absent for NFTs and collections. */
  unit?: string
  /** The asset's image, shown in place of the operation glyph. */
  imageUri?: string
  chain: Pick<TransactionHistoryChain, 'name' | 'iconUri'>
  status: TxHistoryStatus
  timestampMs: number
  /** Absent for `kind: 'unparsed'` placeholders, which are inert rows. */
  transaction?: TransactionHistoryTransaction
}

/** A transaction the host app just sent, tracked until the list shows it. */
export interface PendingTransaction {
  txHash: string
  /** `polling`: refreshing on a backoff. `found`: a loaded entry has the hash.
   * `stopped`: the wait gave up (about 51 s) without finding it. */
  state: 'polling' | 'found' | 'stopped'
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
      /** Set when fetching the next page failed; the loaded entries stay. */
      loadMoreError?: Error
      /** Unix seconds at which the server fetched the first page. Absent
       * when the response carries no `cache`. */
      updatedAt?: number
      refreshing: boolean
      refresh: () => void
      /** Set when the last refresh failed; the loaded entries stay. */
      refreshError?: Error
      pendingTransaction?: PendingTransaction
    }
