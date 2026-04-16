import {
  type LoginWithStampParameters,
  type LoginWithStampReturnType,
  loginWithStamp,
} from '../../actions/auth/loginWithStamp.js'
import {
  type AuthenticateWithEmailParameters,
  type AuthenticateWithEmailReturnType,
  type AuthenticateWithOAuthParameters,
  type AuthenticateWithOAuthReturnType,
  authenticateWithEmail,
  authenticateWithOAuth,
  type GetAuthenticatorsParameters,
  type GetAuthenticatorsReturnType,
  type GetAuthProxyConfigIdReturnType,
  type GetUserWalletParameters,
  type GetUserWalletReturnType,
  type GetWhoamiParameters,
  type GetWhoamiReturnType,
  getAuthenticators,
  getAuthProxyConfigId,
  getUserWallet,
  getWhoami,
  type LoginWithOTPParameters,
  type LoginWithOTPReturnType,
  loginWithOTP,
  type RegisterWithOTPParameters,
  type RegisterWithOTPReturnType,
  type RegisterWithPasskeyParameters,
  type RegisterWithPasskeyReturnType,
  registerWithOTP,
  registerWithPasskey,
  type Sign7702AuthorizationParameters,
  type Sign7702AuthorizationReturnType,
  type SignMessageParameters,
  type SignMessageReturnType,
  type SignTransactionParameters,
  type SignTransactionReturnType,
  type SignTypedDataV4Parameters,
  type SignTypedDataV4ReturnType,
  type SignUserOperationParameters,
  type SignUserOperationReturnType,
  sign7702Authorization,
  signMessage,
  signTransaction,
  signTypedDataV4,
  signUserOperation,
} from '../../actions/index.js'
import type { Client } from '../types.js'

/**
 * ZeroDev Wallet client actions that can be performed with a client
 */
export type ZeroDevWalletActions = {
  // Auth actions
  /**
   * Authenticates a user with their email address
   */
  authenticateWithEmail: (
    params: AuthenticateWithEmailParameters,
  ) => Promise<AuthenticateWithEmailReturnType>

  /**
   * Authenticates a user with OAuth credentials
   */
  authenticateWithOAuth: (
    params: AuthenticateWithOAuthParameters,
  ) => Promise<AuthenticateWithOAuthReturnType>

  /**
   * Gets the current user information
   */
  getWhoami: (params: GetWhoamiParameters) => Promise<GetWhoamiReturnType>

  /**
   * Fetches all authenticators (oauths, passkeys, emailContacts, apiKeys)
   * for the authenticated user within the given project/sub-organization
   */
  getAuthenticators: (
    params: GetAuthenticatorsParameters,
  ) => Promise<GetAuthenticatorsReturnType>

  // Wallet actions
  /**
   * Gets the user's wallet information
   */
  getUserWallet: (
    params: GetUserWalletParameters,
  ) => Promise<GetUserWalletReturnType>

  /**
   * Signs a message with the user's wallet
   */
  signMessage: (params: SignMessageParameters) => Promise<SignMessageReturnType>

  /**
   * Signs a transaction with the user's wallet
   */
  signTransaction: (
    params: SignTransactionParameters,
  ) => Promise<SignTransactionReturnType>

  /**
   * Signs EIP-712 typed data with the user's wallet
   */
  signTypedDataV4: (
    params: SignTypedDataV4Parameters,
  ) => Promise<SignTypedDataV4ReturnType>

  /**
   * Signs a user operation with the user's wallet
   */
  signUserOperation: (
    params: SignUserOperationParameters,
  ) => Promise<SignUserOperationReturnType>

  /**
   * Signs an EIP-7702 authorization with the user's wallet
   */
  sign7702Authorization: (
    params: Sign7702AuthorizationParameters,
  ) => Promise<Sign7702AuthorizationReturnType>

  /**
   * Registers a passkey with the user's wallet
   */
  registerWithPasskey: (
    params: RegisterWithPasskeyParameters,
  ) => Promise<RegisterWithPasskeyReturnType>

  /**
   * Logs in a user with a stamp
   */
  loginWithStamp: (
    params: LoginWithStampParameters,
  ) => Promise<LoginWithStampReturnType>

  /**
   * Registers a user with OTP (One-Time Password) authentication
   */
  registerWithOTP: (
    params: RegisterWithOTPParameters,
  ) => Promise<RegisterWithOTPReturnType>

  /**
   * Logs in a user with OTP (One-Time Password) authentication
   */
  loginWithOTP: (
    params: LoginWithOTPParameters,
  ) => Promise<LoginWithOTPReturnType>

  /**
   * Gets the auth proxy config ID from the backend
   */
  getAuthProxyConfigId: () => Promise<GetAuthProxyConfigIdReturnType>
}

/**
 * Decorator function that adds ZeroDev Wallet client actions to a client
 *
 * @param client - The base client to extend
 * @returns An object containing all ZeroDev Wallet client actions bound to the client
 *
 * @example
 * ```ts
 * import { createClient, zeroDevWalletTransport, zeroDevWalletActions } from '@zerodev/wallet-core';
 *
 * const client = createClient({
 *   transport: zeroDevWalletTransport({ baseUrl: 'https://api.example.com' }),
 *   stamper: myStamper,
 * }).extend(zeroDevWalletActions);
 *
 * // Now you can use actions directly on the client
 * const userInfo = await client.getWhoami({
 *   organizationId: 'org_123',
 *   projectId: 'proj_456'
 * });
 * ```
 */
export function zeroDevWalletActions(client: Client): ZeroDevWalletActions {
  return {
    // Auth actions
    authenticateWithEmail: (params) => authenticateWithEmail(client, params),
    authenticateWithOAuth: (params) => authenticateWithOAuth(client, params),
    getWhoami: (params) => getWhoami(client, params),
    getAuthenticators: (params) => getAuthenticators(client, params),

    // Wallet actions
    getUserWallet: (params) => getUserWallet(client, params),
    signMessage: (params) => signMessage(client, params),
    signTransaction: (params) => signTransaction(client, params),
    signTypedDataV4: (params) => signTypedDataV4(client, params),
    signUserOperation: (params) => signUserOperation(client, params),
    sign7702Authorization: (params) => sign7702Authorization(client, params),
    registerWithPasskey: (params) => registerWithPasskey(client, params),
    loginWithStamp: (params) => loginWithStamp(client, params),
    registerWithOTP: (params) => registerWithOTP(client, params),
    loginWithOTP: (params) => loginWithOTP(client, params),
    getAuthProxyConfigId: () => getAuthProxyConfigId(client),
  }
}
