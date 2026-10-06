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
export { isCancellationError } from './auth/utils/isCancellationError.js'
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
export { sameWalletName } from './shared/utils/sameWalletName.js'
export { detachEvmConnection } from './solana/evmAdoptionGuard.js'
// Solana (external wallets via the Wallet Standard; the kit signs nothing)
export {
  type SolanaAccount,
  useSolanaAccount,
} from './solana/hooks/useSolanaAccount.js'
export { useSolanaAutoReconnect } from './solana/hooks/useSolanaAutoReconnect.js'
export {
  type SolanaWalletHandle,
  useSolanaWallet,
} from './solana/hooks/useSolanaWallet.js'
export { useSolanaWallets } from './solana/hooks/useSolanaWallets.js'
export type {
  SolanaConnection,
  SolanaConnectionSource,
  SolanaConnectionStatus,
  SolanaStandardWallet,
} from './solana/types.js'
export { zeroDevWalletConnect } from './zeroDevWalletConnect.js'

// Signing
// export type { SignatureRequestProps } from './signing'
// export { SignatureRequest } from './signing'
// export { usePendingRequest } from './signing/hooks/usePendingRequest.js'
// export { usePendingRequests } from './signing/hooks/usePendingRequests.js'
//
// export type { PendingRequest, Request, RequestMethod } from './types.js'
