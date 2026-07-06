import { createContext, useContext } from 'react'
import type { Address } from 'viem'
import type { AddressState, SmartRoutingAddressConfig } from '../types'

export type SmartRoutingAddressContextValue = {
  config: SmartRoutingAddressConfig
  addressState: AddressState
  /** Recipient of the active (or last requested) smart routing address */
  recipient?: Address | undefined
  /**
   * Create the smart routing address for the recipient if it has not been
   * created yet. Safe to call multiple times; concurrent calls for the
   * same recipient share one request, while a new recipient triggers a
   * fresh creation.
   */
  ensureAddress: (recipient: Address) => Promise<void>
}

export const SmartRoutingAddressContext =
  createContext<SmartRoutingAddressContextValue | null>(null)

export function useSmartRoutingAddressContext(): SmartRoutingAddressContextValue {
  const context = useContext(SmartRoutingAddressContext)
  if (!context) {
    throw new Error(
      'Smart routing address components must be rendered inside <SmartRoutingAddressProvider>',
    )
  }
  return context
}
