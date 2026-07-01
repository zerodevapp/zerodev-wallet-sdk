import type { Hex } from 'viem'
import type { Client } from '../../client/types.js'

export type GetUserWalletParameters = {
  /** The organization ID */
  organizationId: string
  /** The project ID for the request */
  projectId: string
  /** The token for the request */
  token: string
}

export type GetUserWalletReturnType = {
  /** The wallet address */
  walletAddresses: Hex[]
  /** The user ID */
  userId?: string
}

/**
 * Gets the user's wallet information
 *
 * @param client - The ZeroDev Wallet client
 * @param params - The parameters for getting wallet info
 * @returns The wallet information
 *
 * @example
 * ```ts
 * const wallet = await getUserWallet(client, {
 *   organizationId: 'org_123',
 *   projectId: 'proj_456'
 * });
 * console.log(wallet.walletAddresses); // ['0x...', '0x...']
 * ```
 */
export async function getUserWallet(
  client: Client,
  params: GetUserWalletParameters,
): Promise<GetUserWalletReturnType> {
  const { projectId, token } = params

  // GET behind StampCheckUser: user is resolved from the stamped credential
  // (+ session JWT); no body sent. The stamp signs the X-Timestamp value.
  return await client.request({
    path: `${projectId}/user-wallet`,
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    stamp: true,
    stampPostion: 'timestamp',
  })
}
