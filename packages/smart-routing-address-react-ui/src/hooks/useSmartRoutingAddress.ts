import type { Address } from 'viem'
import { useSmartRoutingAddressContext } from '../context/SmartRoutingAddressContext'
import type { AddressState } from '../types'

export type UseSmartRoutingAddressResult = {
  addressState: AddressState
  /**
   * Create the address for the recipient if needed (idempotent per
   * recipient; a new recipient triggers a fresh creation)
   */
  ensureAddress: (recipient: Address) => Promise<void>
}

/**
 * Access the smart routing address creation state from anywhere inside the
 * provider, e.g. to pre-create the address before the modal is opened.
 */
export function useSmartRoutingAddress(): UseSmartRoutingAddressResult {
  const { addressState, ensureAddress } = useSmartRoutingAddressContext()
  return { addressState, ensureAddress }
}
