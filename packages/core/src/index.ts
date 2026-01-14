export type {
  // Auth types
  AuthenticateWithEmailParameters,
  AuthenticateWithEmailReturnType,
  AuthenticateWithOAuthParameters,
  AuthenticateWithOAuthReturnType,
  EmailCustomization,
  // Wallet types
  GetUserWalletParameters,
  GetUserWalletReturnType,
  GetWhoamiParameters,
  GetWhoamiReturnType,
  LoginWithOTPParameters,
  LoginWithOTPReturnType,
  OtpContact,
  RegisterWithOTPParameters,
  RegisterWithOTPReturnType,
  SignRawPayloadParameters,
  SignRawPayloadReturnType,
  SignTransactionParameters,
  SignTransactionReturnType,
} from './actions/index.js'

// Actions
export {
  // Auth actions
  authenticateWithEmail,
  authenticateWithOAuth,
  // Wallet actions
  getUserWallet,
  getWhoami,
  loginWithOTP,
  registerWithOTP,
  signRawPayload,
  signTransaction,
} from './actions/index.js'
export type { ToViemAccountParams } from './adapters/viem.js'
// Adapters
export { toViemAccount } from './adapters/viem.js'
export type { ZeroDevWalletActions } from './client/decorators/client.js'
// Client decorators
export { zeroDevWalletActions } from './client/decorators/client.js'
export type { Client, ClientConfig, Transport } from './client/index.js'
// Client
export {
  createBaseClient,
  createClient,
  type ZeroDevWalletClient,
  zeroDevWalletTransport,
} from './client/index.js'
// Constants
export { KMS_SERVER_URL } from './constants.js'
export type {
  AuthParams,
  ZeroDevWalletConfig,
  ZeroDevWalletSDK,
} from './core/createZeroDevWallet.js'
// Core
export { createZeroDevWallet } from './core/createZeroDevWallet.js'
// Stampers
export {
  createIframeStamper,
  createIndexedDbStamper,
  createWebauthnStamper,
} from './stampers/index.js'
export type {
  IframeStamper,
  IndexedDbStamper,
  WebauthnStamper,
} from './stampers/types.js'
// Storage
export type { StorageAdapter, StorageManager } from './storage/manager.js'
// Session types
export type { StamperType, ZeroDevWalletSession } from './types/session.js'
export { exportWallet } from './utils/exportWallet.js'
// Utils
export { normalizeTimestamp } from './utils/utils.js'
