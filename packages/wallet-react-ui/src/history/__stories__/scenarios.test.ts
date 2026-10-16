import type {
  TransactionHistoryItem,
  TransactionHistoryOperation,
} from '@zerodev/wallet-data'
import { describe, expect, it } from 'vitest'
import { toTxHistoryEntry } from '../utils/toTxHistoryEntry'
import { allOperations } from './allOperations'
import { FORMATTING_EXPECTED_VALUES, formatting } from './formatting'
import { SCENARIOS } from './index'
import {
  LONG_HISTORY_LENGTH,
  longHistory,
  longHistoryPages,
} from './longHistory'

const FIXED_NOW = Date.UTC(2026, 9, 13, 15)

// Typecheck fails here when the contract adds an operation, which is the
// signal that allOperations needs a new row.
const OPERATIONS = Object.keys({
  approve: 0,
  bid: 0,
  burn: 0,
  claim: 0,
  delegate: 0,
  deploy: 0,
  deposit: 0,
  execute: 0,
  mint: 0,
  receive: 0,
  revoke: 0,
  revoke_delegation: 0,
  send: 0,
  swap: 0,
  withdraw: 0,
  other: 0,
} satisfies Record<TransactionHistoryOperation, 0>)

const arrays: Record<string, readonly TransactionHistoryItem[]> = {
  ...SCENARIOS,
  formatting: formatting(FIXED_NOW),
  longHistory: longHistory(FIXED_NOW),
}

describe('scenarios', () => {
  it.each(Object.entries(arrays))('%s has unique ids', (_, items) => {
    const ids = items.map((item) => ('kind' in item ? item.txHash : item.id))
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('allOperations covers every operation', () => {
    const operations = allOperations.flatMap((item) =>
      'kind' in item ? [] : [item.operation],
    )
    expect(new Set(operations)).toEqual(new Set(OPERATIONS))
  })

  it('formatting renders the values in its header', () => {
    expect(
      formatting(FIXED_NOW).map((item) => toTxHistoryEntry(item)?.value),
    ).toEqual(FORMATTING_EXPECTED_VALUES)
  })

  it('longHistory splits into four pages of 25', () => {
    const pages = longHistoryPages(FIXED_NOW)
    expect(pages.map((page) => page.length)).toEqual([25, 25, 25, 25])
    expect(pages.flat()).toHaveLength(LONG_HISTORY_LENGTH)
  })
})
