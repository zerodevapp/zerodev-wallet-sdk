/**
 * @zerodev/wallet-react-kit
 * React UI components and enhanced connector for ZeroDev Wallet SDK
 */

// Auth
export { AuthFlow } from './auth'
export { useAuth } from './auth/hooks/useAuth'
export type { AuthMethod, AuthStep } from './auth/types'

// Connector
export type {
  SigningConfig,
  ZeroDevKitConfig,
  ZeroDevKitConnectorParams,
} from './connector.js'
export { zeroDevKitWallet } from './connector.js'

// Signing
export type { SignatureRequestProps } from './signing'
export { SignatureRequest } from './signing'
export { usePendingRequest } from './signing/hooks/usePendingRequest.js'

export type { PendingRequest, Request, RequestMethod } from './types.js'
