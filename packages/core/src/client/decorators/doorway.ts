import type { Client } from "../types.js";
import {
  authenticateWithEmail,
  type AuthenticateWithEmailParameters,
  type AuthenticateWithEmailReturnType,
  authenticateWithOAuth,
  type AuthenticateWithOAuthParameters,
  type AuthenticateWithOAuthReturnType,
  getWhoami,
  type GetWhoamiParameters,
  type GetWhoamiReturnType,
  getUserWallet,
  type GetUserWalletParameters,
  type GetUserWalletReturnType,
  signRawPayload,
  type SignRawPayloadParameters,
  type SignRawPayloadReturnType,
} from "../../actions/index.js";
import { signTransaction, type SignTransactionParameters, type SignTransactionReturnType } from "../../actions/wallet/signTransaction.js";

/**
 * Doorway-specific actions that can be performed with a client
 */
export type DoorwayActions = {
  // Auth actions
  /**
   * Authenticates a user with their email address
   */
  authenticateWithEmail: (
    params: AuthenticateWithEmailParameters
  ) => Promise<AuthenticateWithEmailReturnType>;

  /**
   * Authenticates a user with OAuth credentials
   */
  authenticateWithOAuth: (
    params: AuthenticateWithOAuthParameters
  ) => Promise<AuthenticateWithOAuthReturnType>;

  /**
   * Gets the current user information
   */
  getWhoami: (
    params: GetWhoamiParameters
  ) => Promise<GetWhoamiReturnType>;

  // Wallet actions
  /**
   * Gets the user's wallet information
   */
  getUserWallet: (
    params: GetUserWalletParameters
  ) => Promise<GetUserWalletReturnType>;

  /**
   * Signs a raw payload with the user's wallet
   */
  signRawPayload: (
    params: SignRawPayloadParameters
  ) => Promise<SignRawPayloadReturnType>;

  /**
   * Signs a transaction with the user's wallet
   */
  signTransaction: (
    params: SignTransactionParameters
  ) => Promise<SignTransactionReturnType>;
};

/**
 * Decorator function that adds Doorway-specific actions to a client
 *
 * @param client - The base client to extend
 * @returns An object containing all Doorway actions bound to the client
 *
 * @example
 * ```ts
 * import { createClient, doorwayTransport, doorwayActions } from '@doorway/core';
 *
 * const client = createClient({
 *   transport: doorwayTransport({ baseUrl: 'https://api.example.com' }),
 *   stamper: myStamper,
 * }).extend(doorwayActions);
 *
 * // Now you can use actions directly on the client
 * const userInfo = await client.getWhoami({
 *   organizationId: 'org_123',
 *   projectId: 'proj_456'
 * });
 * ```
 */
export function doorwayActions(client: Client): DoorwayActions {
  return {
    // Auth actions
    authenticateWithEmail: (params) => authenticateWithEmail(client, params),
    authenticateWithOAuth: (params) => authenticateWithOAuth(client, params),
    getWhoami: (params) => getWhoami(client, params),

    // Wallet actions
    getUserWallet: (params) => getUserWallet(client, params),
    signRawPayload: (params) => signRawPayload(client, params),
    signTransaction: (params) => signTransaction(client, params),
  };
}