/**
 * @zerodev/smart-routing-address-react-ui
 * React hooks, provider, and UI for ZeroDev Smart Routing Address deposits.
 */

// Provider
export type { SmartRoutingAddressProviderProps } from './context/SmartRoutingAddressProvider'
export { SmartRoutingAddressProvider } from './context/SmartRoutingAddressProvider'
// Widget companion hooks — for hosts embedding <SmartRoutingAddress />, not
// for building custom deposit UIs (use @zerodev/smart-routing-address for
// that). useSmartRoutingAddress reads state; useCreateSmartRoutingAddress
// performs the create action. Data-plumbing hooks (useDepositStatus,
// useNewDeposits) are internal.
export type { UseCreateSmartRoutingAddressResult } from './hooks/useCreateSmartRoutingAddress'
export { useCreateSmartRoutingAddress } from './hooks/useCreateSmartRoutingAddress'
export type { UseSmartRoutingAddressResult } from './hooks/useSmartRoutingAddress'
export { useSmartRoutingAddress } from './hooks/useSmartRoutingAddress'

// Pages
export type {
  SmartRoutingAddressProps,
  SmartRoutingAddressStep,
} from './pages'
export { SmartRoutingAddress } from './pages'

// Types
export type { OnrampWidgetParams, SmartRoutingAddressConfig } from './types'
