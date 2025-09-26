import type { Client } from "../../client/types.js";

export type EmailCustomization = {
  /** A template for the URL to be used in a magic link button, e.g. `https://dapp.xyz/%s`. The auth bundle will be interpolated into the `%s`. */
  magicLinkTemplate?: string;
};

export type AuthenticateWithEmailParameters = {
  /** The email address to authenticate */
  email: string;
  /** The project ID for the request */
  projectId: string;
  /** Target public key for authentication */
  targetPublicKey: string;
  /** Optional email customization settings */
  emailCustomization?: EmailCustomization;
};

export type AuthenticateWithEmailReturnType = {
  /** The user ID */
  userId?: string;
  /** The wallet address */
  walletAddress?: string;
  /** The sub-organization ID */
  subOrganizationId?: string;
  /** Whether magic link is required */
  requiresMagicLink?: boolean;
  /** The Turnkey session if available */
  turnkeySession?: string;
};

/**
 * Authenticates a user with their email address
 *
 * @param client - The Doorway client
 * @param params - The parameters for email authentication
 * @returns The authentication result
 *
 * @example
 * ```ts
 * const result = await authenticateWithEmail(client, {
 *   email: 'user@example.com',
 *   projectId: 'proj_456',
 *   targetPublicKey: '0x...',
 *   emailCustomization: {
 *     magicLinkTemplate: 'https://app.example.com/auth/%s'
 *   }
 * });
 * ```
 */
export async function authenticateWithEmail(
  client: Client,
  params: AuthenticateWithEmailParameters
): Promise<AuthenticateWithEmailReturnType> {
  const { email, projectId, targetPublicKey, emailCustomization } = params;

  return await client.request({
    path: `${projectId}/auth/email-magic`,
    method: "POST",
    body: {
      email,
      emailCustomization,
      targetPublicKey,
      projectId,
    },
  });
}