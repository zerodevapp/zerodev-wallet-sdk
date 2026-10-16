import { ALL_OPERATION_SPECS } from './allOperations'
import { HOUR, middayOf } from './builders'
import { scenario } from './goldens'

export const LONG_HISTORY_LENGTH = 100
export const LONG_HISTORY_PAGE_SIZE = 25

/** The allOperations rows repeated to 100, an hour apart back from midday. */
export function longHistory(nowMs: number) {
  const specs = Array.from(
    { length: Math.ceil(LONG_HISTORY_LENGTH / ALL_OPERATION_SPECS.length) },
    () => ALL_OPERATION_SPECS,
  )
    .flat()
    .slice(0, LONG_HISTORY_LENGTH)
  return scenario(specs, { base: middayOf(nowMs), step: HOUR })
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
