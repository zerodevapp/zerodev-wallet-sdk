import { isReactNative } from './utils/platform.js'

if (isReactNative()) {
  // biome-ignore lint/suspicious/noConsole: Warning users if they try to use the web entry on React Native.
  console.warn(
    '@zerodev/wallet-core: the web entry was loaded in a React Native runtime. Check that your metro.config.js has `unstable_enablePackageExports: true` and `"react-native"` in `unstable_conditionNames`.',
  )
}

export type {
  // Auth types
  ApiKeyAuthenticator,
  AuthenticateWithEmailParameters,
  AuthenticateWithEmailReturnType,
  AuthenticateWithOAuthParameters,
  AuthenticateWithOAuthReturnType,
  EmailContact,
  GetAuthenticatorsParameters,
  GetAuthenticatorsReturnType,
  // Wallet types
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

// Actions
export {
  // Auth actions
  authenticateWithEmail,
  authenticateWithOAuth,
  getAuthenticators,
  // Wallet actions
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
// Adapters
export { toViemAccount } from './adapters/viem.js'
export type { ZeroDevWalletActions } from './client/decorators/client.js'
// Client decorators
export { zeroDevWalletActions } from './client/decorators/client.js'
export type {
  Client,
  ClientConfig,
  CreateTransportOptions,
  Transport,
} from './client/index.js'
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
  ZeroDevWalletSDK,
} from './core/createZeroDevWalletCore.js'
// Stampers
export { createIframeStamper } from './stampers/iframeStamper.js'
export type {
  ApiKeyStamper,
  Attestation,
  IframeStamper,
  PasskeyRegistrationOptions,
  PasskeyRegistrationResult,
  PasskeyStamper,
} from './stampers/types.js'
// Storage
export type { StorageAdapter, StorageManager } from './storage/manager.js'
// Session types
export type { StamperType, ZeroDevWalletSession } from './types/session.js'
export type { KeyFormat } from './utils/exportPrivateKey.js'
export { exportPrivateKey } from './utils/exportPrivateKey.js'
export { exportWallet } from './utils/exportWallet.js'
// Utils
export { normalizeTimestamp } from './utils/utils.js'
// Core — bare specifier resolves web defaults (IndexedDB, WebAuthn, session
// storage, hostname-derived rpId) before forwarding to the shared factory.
// RN consumers go through `@zerodev/wallet-core/react-native`, which exposes
// the strict `ZeroDevWalletConfig` (= core's required-fields shape) directly.
export {
  createZeroDevWallet,
  type ZeroDevWalletConfig,
} from './web/createZeroDevWallet.js'
