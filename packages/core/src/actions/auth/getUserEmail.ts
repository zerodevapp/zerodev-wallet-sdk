import type { Client } from '../../client/types.js'

export type GetUserEmailParameters = {
  /** The organization ID to query */
  organizationId: string
  /** The project ID for the request */
  projectId: string
}

export type GetUserEmailReturnType = {
  /** The user's email address */
  email: string
}

/**
 * Gets the user's email address
 *
 * @param client - The ZeroDev Wallet client
 * @param params - The parameters for the user email request
 * @returns The user's email address
 *
 * @example
 * ```ts
 * const userEmail = await getUserEmail(client, {
 *   organizationId: 'org_123',
 *   projectId: 'proj_456'
 * });
 * console.log(userEmail.email); // 'user@example.com'
 * ```
 */
export async function getUserEmail(
  client: Client,
  params: GetUserEmailParameters,
): Promise<GetUserEmailReturnType> {
  const { organizationId, projectId } = params

  return await client.request({
    path: `${projectId}/user-email`,
    method: 'POST',
    body: {
      organizationId,
    },
    stamp: true,
    stampPostion: 'headers',
  })
}
