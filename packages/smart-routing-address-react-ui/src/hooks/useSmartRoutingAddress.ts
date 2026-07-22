import type { Address } from 'viem'
import { useSmartRoutingAddressContext } from '../context/SmartRoutingAddressContext'
import type { ActiveRoute, AddressState } from '../types'

export type UseSmartRoutingAddressResult = {
  addressState: AddressState
  /**
   * Create the address for the recipient if needed (idempotent per
   * recipient; a new recipient triggers a fresh creation)
   */
  ensureAddress: (recipient: Address) => Promise<void>
  /**
   * The route the deposit UI is currently showing (source token + chain +
   * estimated fee). `null` until the picker has seeded a selection.
   */
  activeRoute: ActiveRoute | null
}

/**
 * Access the smart routing address creation state from anywhere inside the
 * provider, e.g. to pre-create the address before the modal is opened.
 */
export function useSmartRoutingAddress(): UseSmartRoutingAddressResult {
  const { addressState, ensureAddress, activeRoute } =
    useSmartRoutingAddressContext()
  return { addressState, ensureAddress, activeRoute }
}
