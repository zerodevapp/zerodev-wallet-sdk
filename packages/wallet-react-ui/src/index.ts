/**
 * @zerodev/wallet-react-ui
 * React UI components and enhanced connector for ZeroDev Wallet SDK
 */

// Auth
export { ConnectWallet } from './auth'
export { useAuth } from './auth/hooks/useAuth'
export { SignUp } from './auth/pages/SignUp'
export type { AuthMethod, AuthStep, EmailAuthMethod } from './auth/types'
export type { WalletId } from './auth/walletGuide'

// Connector
export type {
  // SigningConfig,
  ZeroDevKitConnectorParams,
} from './connector.js'
export { zeroDevWallet } from './connector.js'
export { zeroDevWalletConnect } from './zeroDevWalletConnect.js'

// History
export {
  TxHistory,
  type TxHistoryProps,
  type TxHistoryStep,
} from './history/pages'
export type { TxHistoryEntry } from './history/types'

// Signing
// export type { SignatureRequestProps } from './signing'
// export { SignatureRequest } from './signing'
// export { usePendingRequest } from './signing/hooks/usePendingRequest.js'
// export { usePendingRequests } from './signing/hooks/usePendingRequests.js'
//
// export type { PendingRequest, Request, RequestMethod } from './types.js'
