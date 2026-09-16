import type { Client } from '../../client/types.js'
import type { SigningStamper } from '../../stampers/types.js'
import type { WalletSetDetails } from './listServerWallets.js'

export type ListWalletSetsParameters = {
  /** The project ID for the request */
  projectId: string
}

export type ListWalletSetsReturnType = WalletSetDetails

/**
 * Returns the agent's wallet set. Requires the `read` role.
 */
export async function listWalletSets(
  client: Client<undefined, SigningStamper>,
  params: ListWalletSetsParameters,
): Promise<ListWalletSetsReturnType> {
  return client.request({
    path: `${params.projectId}/server-wallet/wallet-sets`,
    method: 'GET',
    stamp: true,
    stampPostion: 'timestamp',
  })
}
