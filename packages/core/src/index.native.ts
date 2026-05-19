import { isReactNative } from './utils/platform.js'

if (!isReactNative()) {
  // biome-ignore lint/suspicious/noConsole: Warning users if they try to use the web entry on React Native.
  console.warn(
    '@zerodev/wallet-core/react-native: the React Native entry was loaded outside a React Native runtime. If this is a non-RN context, import `@zerodev/wallet-core` (the bare specifier) instead.',
  )
}

// Re-export shared API surface. Note: we intentionally do NOT re-export the
// web stamper factories (createIndexedDbStamper, createWebauthnStamper,
// createIframeStamper) here — they're web-only. The native adapter factories
// live behind their own granular subpaths so consumers using alternative
// adapters (Keychain, MMKV, custom) skip the unused peer-dep installs.
export type {
  ApiKeyAuthenticator,
  AuthenticateWithEmailParameters,
  AuthenticateWithEmailReturnType,
  AuthenticateWithOAuthParameters,
  AuthenticateWithOAuthReturnType,
  EmailContact,
  EmailCustomization,
  GetAuthenticatorsParameters,
  GetAuthenticatorsReturnType,
  GetUserWalletParameters,
  GetUserWalletReturnType,
  GetWhoamiParameters,
  GetWhoamiReturnType,
  LoginWithOTPParameters,
  LoginWithOTPReturnType,
  OAuthAuthenticator,
  OtpContact,
  PasskeyAuthenticator,
  RegisterWithOTPParameters,
  RegisterWithOTPReturnType,
  Sign7702AuthorizationParameters,
  Sign7702AuthorizationReturnType,
  SignMessageParameters,
  SignMessageReturnType,
  SignTransactionParameters,
  SignTransactionReturnType,
  SignTypedDataV4Parameters,
  SignTypedDataV4ReturnType,
  SignUserOperationParameters,
  SignUserOperationReturnType,
} from './actions/index.js'
export {
  authenticateWithEmail,
  authenticateWithOAuth,
  getAuthenticators,
  getUserWallet,
  getWhoami,
  loginWithOTP,
  registerWithOTP,
  sign7702Authorization,
  signMessage,
  signTransaction,
  signTypedDataV4,
  signUserOperation,
} from './actions/index.js'
export type { ToViemAccountParams } from './adapters/viem.js'
export { toViemAccount } from './adapters/viem.js'
export type { ZeroDevWalletActions } from './client/decorators/client.js'
export { zeroDevWalletActions } from './client/decorators/client.js'
export type {
  Client,
  ClientConfig,
  CreateTransportOptions,
  Transport,
} from './client/index.js'
export {
  createBaseClient,
  createClient,
  type ZeroDevWalletClient,
  zeroDevWalletTransport,
} from './client/index.js'
export { KMS_SERVER_URL } from './constants.js'
export type {
  AuthParams,
  ZeroDevWalletSDK,
} from './core/createZeroDevWalletCore.js'
// RN entry re-exports core directly. `ZeroDevWalletConfigCore` already has
// all four adapter fields required, so RN consumers get compile-time enforcement
// without a separate type wrapper.
export {
  createZeroDevWalletCore as createZeroDevWallet,
  type ZeroDevWalletConfigCore as ZeroDevWalletConfig,
} from './core/createZeroDevWalletCore.js'
export type {
  ApiKeyStamper,
  Attestation,
  IframeStamper,
  PasskeyRegistrationOptions,
  PasskeyRegistrationResult,
  PasskeyStamper,
} from './stampers/types.js'
export type { StorageAdapter, StorageManager } from './storage/manager.js'
export type { StamperType, ZeroDevWalletSession } from './types/session.js'
export type { KeyFormat } from './utils/exportPrivateKey.js'
export { exportPrivateKey } from './utils/exportPrivateKey.js'
export { exportWallet } from './utils/exportWallet.js'
export { normalizeTimestamp } from './utils/utils.js'
