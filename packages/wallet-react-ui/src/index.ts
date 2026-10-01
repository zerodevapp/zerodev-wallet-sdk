/**
 * @zerodev/wallet-react-ui
 * React UI components and enhanced connector for ZeroDev Wallet SDK
 */

// Auth
export { ConnectWallet } from './auth'
export { useAuth } from './auth/hooks/useAuth'
// Connected wallet identity (call-compatible with AppKit's useWalletInfo)
export type {
  WalletInfo,
  WalletSource,
} from './auth/hooks/useWalletInfo.js'
export { useWalletInfo } from './auth/hooks/useWalletInfo.js'
export { SignUp } from './auth/pages/SignUp'
export type { AuthMethod, AuthStep, EmailAuthMethod } from './auth/types'
export type { WalletId } from './auth/walletGuide'
// Connector
export type {
  // SigningConfig,
  ZeroDevKitConnectorParams,
} from './connector.js'
export { zeroDevWallet } from './connector.js'
// History
export { TxHistory, type TxHistoryProps } from './history/pages'
export { History, type HistoryProps } from './history/pages/History'
export type { HistoryFeed, TxHistoryEntry } from './history/types'
export { toTxHistoryEntry } from './history/utils/toTxHistoryEntry'
export { zeroDevWalletConnect } from './zeroDevWalletConnect.js'

// Signing
// export type { SignatureRequestProps } from './signing'
// export { SignatureRequest } from './signing'
// export { usePendingRequest } from './signing/hooks/usePendingRequest.js'
// export { usePendingRequests } from './signing/hooks/usePendingRequests.js'
//
// export type { PendingRequest, Request, RequestMethod } from './types.js'
