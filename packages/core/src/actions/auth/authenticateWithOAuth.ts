import type { Client } from '../../client/types.js'

export type AuthenticateWithOAuthParameters = {
  /** The OAuth provider (e.g., 'google') */
  provider: string
  /** The project ID for the request */
  projectId: string
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
 * Authenticates a user with OAuth using cookie-based backend flow
 *
 * The backend reads the OAuth session from a cookie set during the OAuth flow.
 * This requires the OAuth popup flow to complete first via the backend's
 * /oauth/google/login endpoint.
 *
 * @param client - The ZeroDev Wallet client
 * @param params - The parameters for OAuth authentication
 * @returns The authentication result
 *
 * @example
 * ```ts
 * const result = await authenticateWithOAuth(client, {
 *   provider: 'google',
 *   projectId: 'proj_456',
 * });
 * ```
 */
export async function authenticateWithOAuth(
  client: Client,
  params: AuthenticateWithOAuthParameters,
): Promise<AuthenticateWithOAuthReturnType> {
  const { projectId } = params

  return await client.request({
    path: `${projectId}/auth/oauth`,
    method: 'POST',
    body: null,
    credentials: 'include',
  })
}
