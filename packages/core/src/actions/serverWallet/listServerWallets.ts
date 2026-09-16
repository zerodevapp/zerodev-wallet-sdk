import type { Client } from '../../client/types.js'
import type { SigningStamper } from '../../stampers/types.js'

/** Mirrors the KMS `WalletSetDetails` response field for field. */
export type WalletSetDetails = {
  WalletSet: {
    ProjectId: string
    SubOrgId: string
    OwnerUserId: string
    AgentUserId: string
    Name: string
  }
  Wallets: {
    WalletId: string
    WalletAddress: string
    WalletType: string
    Primary: boolean
  }[]
  AgentKeys: {
    ApiPublicKey: string
    TurnkeyApiKeyId: string
    Name: string
    Roles: string[]
    ExpiresAt: string | null
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
  return client.request({
    path: `${params.projectId}/server-wallet/wallets`,
    method: 'GET',
    stamp: true,
    stampPostion: 'timestamp',
  })
}
