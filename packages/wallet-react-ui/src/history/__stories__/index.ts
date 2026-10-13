import type { TransactionHistoryItem } from '@zerodev/wallet-data'
import { allOperations } from './allOperations'
import { chains } from './chains'
import { fees } from './fees'
import { formatting } from './formatting'
import { longHistory } from './longHistory'
import { statuses } from './statuses'
import { testnet } from './testnet'
import { tokenGaps } from './tokenGaps'
import { unparsed } from './unparsed'

export type ScenarioId =
  | 'allOperations'
  | 'statuses'
  | 'unparsed'
  | 'tokenGaps'
  | 'fees'
  | 'chains'
  | 'testnet'
  | 'formatting'
  | 'longHistory'

/** `formatting` and `longHistory` anchor to load time for Today/Yesterday. */
export const SCENARIOS: Record<ScenarioId, readonly TransactionHistoryItem[]> =
  {
    allOperations,
    statuses,
    unparsed,
    tokenGaps,
    fees,
    chains,
    testnet,
    formatting: formatting(Date.now()),
    longHistory: longHistory(Date.now()),
  }
