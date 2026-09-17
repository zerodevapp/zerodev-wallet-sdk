import type { Client } from '../../client/types.js'
import { AGENT_STAMP_HEADER } from '../../constants.js'
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
  const timestamp = Date.now().toString()
  const stamp = await client.apiKeyStamper.stamp(timestamp)
  return client.request({
    path: `${params.projectId}/server-wallet/wallet-sets`,
    method: 'GET',
    headers: {
      'X-Timestamp': timestamp,
      [AGENT_STAMP_HEADER]: stamp.stampHeaderValue,
    },
  })
}
