import type { Client } from '../../client/types.js'
import { AGENT_STAMP_HEADER } from '../../constants.js'
import type { SigningStamper } from '../../stampers/types.js'

/** Mirrors the KMS `WalletSetDetails` response field for field. */
/** The KMS wallet-set response, `dto.WalletSetDetailsResponse` in doorway-kms. */
export type WalletSetDetails = {
  walletSet: {
    projectId: string
    subOrgId: string
    ownerUserId: string
    agentUserId: string
    name: string
  }
  wallets: {
    walletId: string
    walletAddress: string
    walletType: string
    primary: boolean
  }[]
  agentKeys: {
    apiPublicKey: string
    turnkeyApiKeyId: string
    name: string
    roles: string[]
    /** Absent when the key does not expire. */
    expiresAt?: string
  }[]
}

export type ListServerWalletsParameters = {
  /** The project ID for the request */
  projectId: string
}

export type ListServerWalletsReturnType = WalletSetDetails

/**
 * Lists the wallets in the agent's wallet set. Requires the `read` role.
 * A GET behind the agent stamp check: the stamp signs the `X-Timestamp` value.
 */
export async function listServerWallets(
  client: Client<undefined, SigningStamper>,
  params: ListServerWalletsParameters,
): Promise<ListServerWalletsReturnType> {
  const timestamp = Date.now().toString()
  const stamp = await client.apiKeyStamper.stamp(timestamp)
  return client.request({
    path: `${params.projectId}/server-wallet/wallets`,
    method: 'GET',
    headers: {
      'X-Timestamp': timestamp,
      [AGENT_STAMP_HEADER]: stamp.stampHeaderValue,
    },
  })
}
