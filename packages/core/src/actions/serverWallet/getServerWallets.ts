import type { Hex } from 'viem'
import type { Client } from '../../client/types.js'
import { AGENT_STAMP_HEADER } from '../../constants.js'
import type { SigningStamper } from '../../stampers/types.js'

export type GetServerWalletsParameters = {
  /** The project ID for the request */
  projectId: string
}

export type GetServerWalletsReturnType = {
  /** Every address in the wallet set: each wallet's first address and those added with `createServerWalletAddress`. */
  walletAddresses: Hex[]
}

/**
 * Lists the addresses of the agent's wallet set. Requires the `read` role.
 * A GET behind the agent middleware: the stamp signs the `X-Timestamp` value,
 * there is no body and no Turnkey activity, so no organizationId is needed.
 */
export async function getServerWallets(
  client: Client<undefined, SigningStamper>,
  params: GetServerWalletsParameters,
): Promise<GetServerWalletsReturnType> {
  const timestamp = Date.now().toString()
  const stamp = await client.apiKeyStamper.stamp(timestamp)

  const response = await client.request<{ walletAddresses: Hex[] | null }>({
    path: `${params.projectId}/server-wallet/wallets`,
    method: 'GET',
    headers: {
      'X-Timestamp': timestamp,
      [AGENT_STAMP_HEADER]: stamp.stampHeaderValue,
    },
  })
  // An empty set comes back as `null`, a Go nil slice on the wire.
  return { walletAddresses: response.walletAddresses ?? [] }
}
