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
  type GetUserWalletParameters,
  type GetUserWalletReturnType,
  type GetWhoamiParameters,
  type GetWhoamiReturnType,
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
  type SignRawPayloadParameters,
  type SignRawPayloadReturnType,
  signRawPayload,
} from '../../actions/index.js'
import {
  type SignTransactionParameters,
  type SignTransactionReturnType,
  signTransaction,
} from '../../actions/wallet/signTransaction.js'
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

  // Wallet actions
  /**
   * Gets the user's wallet information
   */
  getUserWallet: (
    params: GetUserWalletParameters,
  ) => Promise<GetUserWalletReturnType>

  /**
   * Signs a raw payload with the user's wallet
   */
  signRawPayload: (
    params: SignRawPayloadParameters,
  ) => Promise<SignRawPayloadReturnType>

  /**
   * Signs a transaction with the user's wallet
   */
  signTransaction: (
    params: SignTransactionParameters,
  ) => Promise<SignTransactionReturnType>

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

    // Wallet actions
    getUserWallet: (params) => getUserWallet(client, params),
    signRawPayload: (params) => signRawPayload(client, params),
    signTransaction: (params) => signTransaction(client, params),
    registerWithPasskey: (params) => registerWithPasskey(client, params),
    loginWithStamp: (params) => loginWithStamp(client, params),
    registerWithOTP: (params) => registerWithOTP(client, params),
    loginWithOTP: (params) => loginWithOTP(client, params),
  }
}
