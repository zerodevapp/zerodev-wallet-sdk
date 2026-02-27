import { canonicalizeEx } from 'json-canonicalize'
import type { Client } from '../../client/types.js'

export type GetWhoamiParameters = {
  /** The organization ID to query */
  organizationId: string
  /** The project ID for the request */
  projectId: string
  /** The session token for authorization (required for session-based auth) */
  token?: string
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
 * Gets the current user information.
 *
 * The whoami endpoint requires two stamps:
 * 1. An inner stamp over the payload (for Turnkey verification) embedded in the body
 * 2. An outer stamp over the full body (for KMS middleware) in the X-Stamp header
 *
 * @param client - The ZeroDev Wallet client
 * @param params - The parameters for the whoami request
 * @returns The user information
 *
 * @example
 * ```ts
 * const userInfo = await getWhoami(client, {
 *   organizationId: 'org_123',
 *   projectId: 'proj_456',
 *   token: 'session_token',
 * });
 * console.log(userInfo.userId); // 'user_789'
 * ```
 */
export async function getWhoami(
  client: Client,
  params: GetWhoamiParameters,
): Promise<GetWhoamiReturnType> {
  const { organizationId, projectId, token } = params

  // Step 1: Inner stamp over the payload (for Turnkey verification)
  const innerBody = { organizationId }
  const innerBodyString = canonicalizeEx(innerBody)
  const innerStamp = await client.indexedDbStamper.stamp(innerBodyString)

  // Step 2: Build full body with inner stamp embedded
  const fullBody = {
    ...innerBody,
    stamp: {
      stampHeaderName: innerStamp.stampHeaderName,
      stampHeaderValue: innerStamp.stampHeaderValue,
    },
  }

  // Step 3: Outer stamp over full body (for KMS middleware)
  const fullBodyString = canonicalizeEx(fullBody)
  const outerStamp = await client.indexedDbStamper.stamp(fullBodyString)

  return await client.request({
    path: `${projectId}/whoami`,
    method: 'POST',
    body: fullBody,
    headers: {
      [outerStamp.stampHeaderName]: outerStamp.stampHeaderValue,
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  })
}
