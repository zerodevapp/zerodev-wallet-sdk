import type { Client } from '../../client/types.js'

export type AuthenticateWithOAuthParameters = {
  /** The OAuth credential/token */
  oidcToken: string
  /** The OAuth provider (e.g., 'google') */
  provider: string
  /** The project ID for the request */
  projectId: string
  /** Target public key for authentication */
  targetPublicKey: string
}

export type AuthenticateWithOAuthReturnType = {
  /** The user ID */
  userId?: string
  /** The wallet address */
  walletAddress?: string
  /** The sub-organization ID */
  subOrganizationId?: string
  /** The Turnkey session */
  turnkeySession?: string
}

/**
 * Authenticates a user with OAuth credentials
 *
 * @param client - The ZeroDev Wallet client
 * @param params - The parameters for OAuth authentication
 * @returns The authentication result
 *
 * @example
 * ```ts
 * const result = await authenticateWithOAuth(client, {
 *   oidcToken: 'oauth_token_here',
 *   provider: 'google',
 *   projectId: 'proj_456',
 *   targetPublicKey: '0x...'
 * });
 * ```
 */
export async function authenticateWithOAuth(
  client: Client,
  params: AuthenticateWithOAuthParameters,
): Promise<AuthenticateWithOAuthReturnType> {
  const { oidcToken, provider, projectId, targetPublicKey } = params

  return await client.request({
    path: `${projectId}/auth/oauth`,
    method: 'POST',
    body: {
      oidcToken,
      provider,
      targetPublicKey,
      projectId,
    },
  })
}
