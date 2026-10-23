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
export {
  AuthFlowDismissedError,
  isCancellationError,
} from './auth/utils/isCancellationError.js'
export type { WalletId } from './auth/walletGuide'
// Connector
export type {
  // SigningConfig,
  ZeroDevKitConnectorParams,
} from './connector.js'
export { zeroDevWallet } from './connector.js'
// History
export {
  TxHistory,
  type TxHistoryProps,
  type TxHistoryStep,
} from './history/pages'
export type { TxHistoryEntry } from './history/types'
// Kit: both namespaces behind one hook
export type {
  KitAccount,
  KitAccountStatus,
  KitAdapter,
  KitConnectParams,
  KitConnectRequest,
  KitDisconnectParams,
  KitNamespace,
  KitWallet,
  ZeroDevWalletKit,
  ZeroDevWalletKitOptions,
} from './kit/types.js'
export { useZeroDevWalletKit } from './kit/useZeroDevWalletKit.js'
// Solana signing (the kit signs nothing: the handle relays to the wallet's
// own features). Connection state, wallets and connect/disconnect are on
// `useZeroDevWalletKit`.
export {
  type SolanaWalletHandle,
  useSolanaWallet,
} from './solana/hooks/useSolanaWallet.js'
export type {
  SolanaConnection,
  SolanaConnectionSource,
  SolanaConnectionStatus,
  SolanaStandardWallet,
} from './solana/types.js'
export {
  type ZeroDevWalletConnectParams,
  zeroDevWalletConnect,
} from './zeroDevWalletConnect.js'

// Signing
// export type { SignatureRequestProps } from './signing'
// export { SignatureRequest } from './signing'
// export { usePendingRequest } from './signing/hooks/usePendingRequest.js'
// export { usePendingRequests } from './signing/hooks/usePendingRequests.js'
//
// export type { PendingRequest, Request, RequestMethod } from './types.js'
