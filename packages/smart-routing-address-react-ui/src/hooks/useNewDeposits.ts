import type { DepositedToken } from '@zerodev/smart-routing-address'
import { useMemo, useRef } from 'react'
import { getDepositKey, getNewDeposits } from '../utils/deposits'

/**
 * Tracks deposits that arrived after the first loaded status snapshot.
 * The snapshot taken when `ready` first becomes true acts as the baseline,
 * so pre-existing deposits are not reported as new.
 */
export function useNewDeposits(
  deposits: DepositedToken[],
  ready: boolean,
): DepositedToken[] {
  const baselineRef = useRef<ReadonlySet<string> | null>(null)

  if (ready && baselineRef.current === null) {
    baselineRef.current = new Set(deposits.map(getDepositKey))
  }

  const baseline = baselineRef.current
  return useMemo(() => {
    if (!baseline) return []
    return getNewDeposits(deposits, baseline)
  }, [deposits, baseline])
}
