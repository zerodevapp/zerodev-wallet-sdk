// Auth actions
export {
  type AuthenticateWithEmailParameters,
  type AuthenticateWithEmailReturnType,
  type AuthenticateWithOAuthParameters,
  type AuthenticateWithOAuthReturnType,
  authenticateWithEmail,
  authenticateWithOAuth,
  type EmailCustomization,
  type GetWhoamiParameters,
  type GetWhoamiReturnType,
  getWhoami,
  type LoginWithOTPParameters,
  type LoginWithOTPReturnType,
  loginWithOTP,
  type OtpContact,
  type RegisterWithOTPParameters,
  type RegisterWithOTPReturnType,
  type RegisterWithPasskeyParameters,
  type RegisterWithPasskeyReturnType,
  registerWithOTP,
  registerWithPasskey,
} from './auth/index.js'

// Wallet actions
export {
  type GetUserWalletParameters,
  type GetUserWalletReturnType,
  getUserWallet,
  type SignRawPayloadParameters,
  type SignRawPayloadReturnType,
  type SignTransactionParameters,
  type SignTransactionReturnType,
  signRawPayload,
  signTransaction,
} from './wallet/index.js'
