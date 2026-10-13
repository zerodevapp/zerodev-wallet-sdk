import type { TransactionHistoryItem } from '@zerodev/wallet-data'
import { ALL_OPERATION_SPECS } from './allOperations'
import { HOUR, middayOf, tx } from './builders'

export const LONG_HISTORY_LENGTH = 100
export const LONG_HISTORY_PAGE_SIZE = 25

/** The allOperations rows repeated to 100, an hour apart back from midday. */
export function longHistory(nowMs: number) {
  const base = middayOf(nowMs)
  const specs = Array.from(
    { length: Math.ceil(LONG_HISTORY_LENGTH / ALL_OPERATION_SPECS.length) },
    () => ALL_OPERATION_SPECS,
  )
    .flat()
    .slice(0, LONG_HISTORY_LENGTH)
  return specs.map(({ key, fields }, i) =>
    tx(1000 + i, fields, key, base - i * HOUR),
  ) satisfies readonly TransactionHistoryItem[]
}

export function longHistoryPages(nowMs: number) {
  const items = longHistory(nowMs)
  return Array.from(
    { length: LONG_HISTORY_LENGTH / LONG_HISTORY_PAGE_SIZE },
    (_, page) =>
      items.slice(
        page * LONG_HISTORY_PAGE_SIZE,
        (page + 1) * LONG_HISTORY_PAGE_SIZE,
      ),
  )
}
