/**
 * @zerodev/smart-routing-address-react-ui
 * React hooks, provider, and UI for ZeroDev Smart Routing Address deposits.
 */

// Components
export {
  PendingDeposits,
  type PendingDepositsProps,
} from './components/PendingDeposits'
export { QrSheet, type QrSheetProps } from './components/QrSheet'
export {
  TxnItem,
  type TxnItemProps,
  type TxnStatus,
} from './components/TxnItem'
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

// Pages
export type {
  SmartRoutingAddressProps,
  SmartRoutingAddressStep,
} from './pages'
export { SmartRoutingAddress } from './pages'

// Types
export type { SmartRoutingAddressConfig } from './types'
