import type { Hex } from 'viem'
import type { Client } from '../../client/types.js'

export type GetUserWalletParameters = {
  /** The organization ID */
  organizationId: string
  /** The project ID for the request */
  projectId: string
}

export type GetUserWalletReturnType = {
  /** The wallet address */
  walletAddress: Hex
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
 * console.log(wallet.walletAddress); // '0x...'
 * ```
 */
export async function getUserWallet(
  client: Client,
  params: GetUserWalletParameters,
): Promise<GetUserWalletReturnType> {
  const { organizationId, projectId } = params

  return await client.request({
    path: `${projectId}/user-wallet`,
    body: {
      organizationId,
    },
  })
}
