import type {
  TransactionHistoryItem,
  TransactionHistoryOperation,
} from '@zerodev/wallet-data'
import {
  TRANSACTION_HISTORY_FIXTURES,
  type TransactionHistoryFixtureId,
} from '@zerodev/wallet-data/fixtures'
import { CHAINS, type ChainKey, chain, FIXED_MIDDAY } from './builders'

/**
 * A golden with an override for a shape the Data API has never recorded:
 * an operation Zerion only labels on acts, or a chain outside the catalog.
 */
export interface GoldenSpec {
  id: TransactionHistoryFixtureId
  operation?: TransactionHistoryOperation
  chain?: ChainKey
}

export type ScenarioSpec = TransactionHistoryFixtureId | GoldenSpec

const MINUTES_5 = 5 * 60

/**
 * Goldens share Zerion ids and hashes across shapes, so a scenario re-keys
 * each row by its position and steps the timestamp back `step` seconds per
 * row from `base`. Unparsed rows keep their hash but for the last byte.
 */
export function scenario(
  specs: readonly ScenarioSpec[],
  { base = FIXED_MIDDAY, step = MINUTES_5 } = {},
): TransactionHistoryItem[] {
  return specs.map((raw, i) => {
    const spec: GoldenSpec = typeof raw === 'string' ? { id: raw } : raw
    const item = TRANSACTION_HISTORY_FIXTURES[spec.id]
    const timestamp = base - i * step
    if ('kind' in item) {
      return {
        ...item,
        txHash: `${item.txHash.slice(0, -2)}${i.toString(16).padStart(2, '0')}`,
        ...(item.timestamp !== undefined && { timestamp }),
      }
    }
    return {
      ...item,
      id: `${spec.id}-${i}`,
      timestamp,
      ...(spec.operation && { operation: spec.operation }),
      ...(spec.chain && {
        chainId: CHAINS[spec.chain].id,
        chain: chain(spec.chain, item.txHash),
      }),
    }
  })
}
