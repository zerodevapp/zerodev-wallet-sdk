// Auth actions
export {
  authenticateWithEmail,
  type AuthenticateWithEmailParameters,
  type AuthenticateWithEmailReturnType,
  type EmailCustomization,
  authenticateWithOAuth,
  type AuthenticateWithOAuthParameters,
  type AuthenticateWithOAuthReturnType,
  getWhoami,
  type GetWhoamiParameters,
  type GetWhoamiReturnType,
} from "./auth/index.js";

// Wallet actions
export {
  getUserWallet,
  type GetUserWalletParameters,
  type GetUserWalletReturnType,
  signRawPayload,
  type SignRawPayloadParameters,
  type SignRawPayloadReturnType,
} from "./wallet/index.js";