import type { Client } from '../../client/types.js'

export type GetWhoamiParameters = {
  /** The organization ID to query */
  organizationId: string
  /** The project ID for the request */
  projectId: string
}

export type GetWhoamiReturnType = {
  /** The user's ID */
  userId: string
  /** The organization ID */
  organizationId: string
  /** The organization name */
  organizationName?: string
  /** The username */
  username?: string
}

/**
 * Gets the current user information
 *
 * @param client - The ZeroDev Signer client
 * @param params - The parameters for the whoami request
 * @returns The user information
 *
 * @example
 * ```ts
 * const userInfo = await getWhoami(client, {
 *   organizationId: 'org_123',
 *   projectId: 'proj_456'
 * });
 * console.log(userInfo.userId); // 'user_789'
 * ```
 */
export async function getWhoami(
  client: Client,
  params: GetWhoamiParameters,
): Promise<GetWhoamiReturnType> {
  const { organizationId, projectId } = params

  return await client.request({
    path: `${projectId}/whoami`,
    method: 'POST',
    body: {
      organizationId,
    },
    stamp: true,
  })
}
