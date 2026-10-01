import type { IconName } from '@zerodev/react-ui'
import type { TransactionHistoryChain } from '@zerodev/wallet-data'

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
}
