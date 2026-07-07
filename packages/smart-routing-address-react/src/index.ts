/**
 * @zerodev/smart-routing-address-react
 * React hooks + provider for ZeroDev Smart Routing Address deposits.
 */

// Provider
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
