import type { DepositedToken } from '@zerodev/smart-routing-address'
import { getSmartRoutingAddressStatus } from '@zerodev/smart-routing-address'
import { useEffect, useState } from 'react'
import type { Address } from 'viem'
import { DEFAULT_POLLING_INTERVAL_MS } from '../constants'

export type UseDepositStatusParams = {
  address: Address | undefined
  enabled?: boolean | undefined
  pollingInterval?: number | undefined
  baseUrl?: string | undefined
}

export type UseDepositStatusResult = {
  deposits: DepositedToken[]
  totalCount: number
  /** True once at least one status response has been received */
  hasLoaded: boolean
  isLoading: boolean
  error: Error | null
}

const INITIAL_STATE: UseDepositStatusResult = {
  deposits: [],
  totalCount: 0,
  hasLoaded: false,
  isLoading: false,
  error: null,
}

/**
 * Polls the smart routing address status endpoint while enabled, returning
 * the current list of deposits.
 */
export function useDepositStatus({
  address,
  enabled = true,
  pollingInterval = DEFAULT_POLLING_INTERVAL_MS,
  baseUrl,
}: UseDepositStatusParams): UseDepositStatusResult {
  const [state, setState] = useState<UseDepositStatusResult>(INITIAL_STATE)

  useEffect(() => {
    if (!address || !enabled) return

    let cancelled = false

    const poll = async () => {
      try {
        const result = await getSmartRoutingAddressStatus({
          smartRoutingAddress: address,
          ...(baseUrl && { config: { baseUrl } }),
        })
        if (cancelled) return
        setState({
          deposits: result.deposits,
          totalCount: result.totalCount,
          hasLoaded: true,
          isLoading: false,
          error: null,
        })
      } catch (error) {
        if (cancelled) return
        setState((previous) => ({
          ...previous,
          isLoading: false,
          error: error instanceof Error ? error : new Error(String(error)),
        }))
      }
    }

    setState((previous) => ({ ...previous, isLoading: true }))
    poll().catch(() => {})
    const intervalId = setInterval(() => {
      poll().catch(() => {})
    }, pollingInterval)

    return () => {
      cancelled = true
      clearInterval(intervalId)
    }
  }, [address, enabled, pollingInterval, baseUrl])

  return state
}
