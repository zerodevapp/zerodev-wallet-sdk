import { type GoldenSpec, scenario } from './goldens'

/**
 * One row per operation, plus a one-sided swap next to the two-sided one.
 * Zerion has never labelled a bid, a delegation, or a revoked delegation on
 * an item the Data API recorded, so those three borrow the asset-less
 * execute golden with the operation swapped.
 */
export const ALL_OPERATION_SPECS: readonly GoldenSpec[] = [
  { id: 'approveFungible' },
  { id: 'executeNoAsset', operation: 'bid' },
  { id: 'burn' },
  { id: 'receiveClaim' },
  { id: 'executeNoAsset', operation: 'delegate' },
  { id: 'deploy' },
  { id: 'deposit' },
  { id: 'execute' },
  { id: 'mint' },
  { id: 'receive' },
  { id: 'revoke' },
  { id: 'executeNoAsset', operation: 'revoke_delegation' },
  { id: 'send' },
  { id: 'swapTwoSided' },
  { id: 'swapOutOnly' },
  { id: 'withdraw' },
  { id: 'operationOther' },
]

export const allOperations = scenario(ALL_OPERATION_SPECS)
