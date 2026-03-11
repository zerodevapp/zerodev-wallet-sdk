import type { Client } from '../../client/types.js'

export type AuthenticateWithOAuthParameters = {
  /** The OAuth provider (e.g., 'google') */
  provider: string
  /** The project ID for the request */
  projectId: string
  /** The session ID from the OAuth callback URL */
  sessionId: string
}

export type AuthenticateWithOAuthReturnType = {
  /** The user ID */
  userId?: string
  /** The wallet address */
  walletAddress?: string
  /** The sub-organization ID */
  subOrganizationId?: string
  /** The Turnkey session */
  session?: string
}

/**
 * Authenticates a user with OAuth using a server-side session ID
 *
 * The backend stores the OAuth session server-side and returns a session ID
 * via the callback URL. The SDK extracts this session ID and sends it in
 * the request body.
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
 *   sessionId: 'abc123',
 * });
 * ```
 */
export async function authenticateWithOAuth(
  client: Client,
  params: AuthenticateWithOAuthParameters,
): Promise<AuthenticateWithOAuthReturnType> {
  const { projectId, sessionId } = params

  return await client.request({
    path: `${projectId}/auth/oauth`,
    method: 'POST',
    body: { sessionId },
  })
}
