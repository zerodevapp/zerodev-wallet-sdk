/**
 * @zerodev/smart-routing-address-react-ui
 * React UI kit for ZeroDev Smart Routing Address deposits.
 */

export type { SmartRoutingAddressProps } from './components/SmartRoutingAddress'
export { SmartRoutingAddress } from './components/SmartRoutingAddress'
// Provider + main component
export type { SmartRoutingAddressProviderProps } from './context/SmartRoutingAddressProvider'
export { SmartRoutingAddressProvider } from './context/SmartRoutingAddressProvider'

// Hooks
export type {
  UseDepositStatusParams,
  UseDepositStatusResult,
} from './hooks/useDepositStatus'
export { useDepositStatus } from './hooks/useDepositStatus'
export { useNewDeposits } from './hooks/useNewDeposits'
export type { UseSmartRoutingAddressResult } from './hooks/useSmartRoutingAddress'
export { useSmartRoutingAddress } from './hooks/useSmartRoutingAddress'

// Types
export type { SmartRoutingAddressConfig } from './types'
