import type { Client } from '../../client/types.js'

export type GetAuthProxyConfigIdReturnType = {
  authProxyConfigId: string
}

/**
 * Fetches the auth proxy config ID from the backend
 *
 * @param client - The ZeroDev Wallet client
 * @returns The auth proxy config ID
 */
export async function getAuthProxyConfigId(
  client: Client,
): Promise<GetAuthProxyConfigIdReturnType> {
  return await client.request({
    path: 'server-info/auth-proxy-id',
    method: 'GET',
  })
}
