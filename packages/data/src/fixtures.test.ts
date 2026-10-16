import { TransactionHistoryResponseSchema } from '@zerodev/data-api-contract'
import { describe, expect, it } from 'vitest'
import {
  TRANSACTION_HISTORY_FIXTURE_IDS,
  TRANSACTION_HISTORY_FIXTURE_LIST,
  TRANSACTION_HISTORY_FIXTURES,
} from './fixtures'

describe('@zerodev/wallet-data/fixtures', () => {
  it('re-exports one item per fixture id', () => {
    expect(TRANSACTION_HISTORY_FIXTURE_IDS.length).toBeGreaterThan(0)
    expect(TRANSACTION_HISTORY_FIXTURE_LIST).toHaveLength(
      TRANSACTION_HISTORY_FIXTURE_IDS.length,
    )
    for (const id of TRANSACTION_HISTORY_FIXTURE_IDS) {
      expect(TRANSACTION_HISTORY_FIXTURES[id]).toBeDefined()
    }
  })

  it('parses every fixture as a page through the response schema', () => {
    const page = TransactionHistoryResponseSchema.parse({
      items: TRANSACTION_HISTORY_FIXTURE_LIST,
    })
    expect(page.items).toEqual(TRANSACTION_HISTORY_FIXTURE_LIST)
  })
})
