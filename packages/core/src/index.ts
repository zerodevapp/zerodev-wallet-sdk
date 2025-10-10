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
export type { ZeroDevSignerActions } from './client/decorators/client.js'
// Client decorators
export { zeroDevSignerActions } from './client/decorators/client.js'
export type { Client, ClientConfig, Transport } from './client/index.js'
// Client
export {
  createBaseClient,
  createClient,
  type ZeroDevSignerClient,
  zeroDevSignerTransport,
} from './client/index.js'
export type {
  AuthParams,
  ZeroDevSignerConfig,
  ZeroDevSignerSDK,
} from './core/createZeroDevSigner.js'
// Core
export { createZeroDevSigner } from './core/createZeroDevSigner.js'
// Storage
export type { StorageAdapter, StorageManager } from './storage/manager.js'
// Session types
export type { StamperType, ZeroDevSignerSession } from './types/session.js'
// Utils
export { normalizeTimestamp } from './utils/utils.js'
