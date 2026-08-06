import type { Client } from '../../client/types.js'

export type LogoutParameters = {
  projectId: string
  organizationId: string
  userId: string
  apiKeyId: string
}

export type LogoutReturnType = Record<string, never>

/** Revokes the caller's current Turnkey session key. */
export async function logout(
  client: Client,
  params: LogoutParameters,
): Promise<LogoutReturnType> {
  const body = {
    organizationId: params.organizationId,
    parameters: {
      apiKeyIds: [params.apiKeyId],
      userId: params.userId,
    },
    timestampMs: Date.now().toString(),
    type: 'ACTIVITY_TYPE_DELETE_API_KEYS',
  }

  return await client.request({
    path: `${params.projectId}/auth/logout`,
    method: 'POST',
    body,
    stamp: true,
    stampWith: 'apiKey',
    stampPostion: 'headers',
  })
}
