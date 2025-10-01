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
  type RegisterWithPasskeyParameters,
  type RegisterWithPasskeyReturnType,
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
