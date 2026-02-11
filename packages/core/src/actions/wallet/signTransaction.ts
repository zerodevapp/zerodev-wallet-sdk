import type { Hex } from 'viem'
import type { Client } from '../../client/types.js'

export type SignTransactionParameters = {
  /** The organization ID */
  organizationId: string
  /** The project ID for the request */
  projectId: string
  /** The session token for authorization */
  token: string
  /** The address to sign with */
  address: Hex
  /** The unsigned transaction to sign */
  unsignedTransaction: string
}

export type SignTransactionReturnType = Hex

/**
 * Signs a raw transaction with the user's wallet
 *
 * @param client - The ZeroDev Wallet client
 * @param params - The parameters for signing
 * @returns The signature
 *
 * @example
 * ```ts
 * const result = await signTransaction(client, {
 *   organizationId: 'org_123',
 *   projectId: 'proj_456',
 *   address: '0x123...',
 *   unsignedTransaction: 'abc123...',
 * });
 * console.log(result.signature); // '0x...'
 * ```
 */
export async function signTransaction(
  client: Client,
  params: SignTransactionParameters,
): Promise<SignTransactionReturnType> {
  const { organizationId, projectId, token, address, unsignedTransaction } =
    params

  const { signature } = await client.request({
    path: `${projectId}/sign/transaction`,
    body: {
      type: 'ACTIVITY_TYPE_SIGN_TRANSACTION_V2',
      timestampMs: Date.now().toString(),
      organizationId,
      parameters: {
        signWith: address,
        type: 'TRANSACTION_TYPE_ETHEREUM',
        unsignedTransaction,
      },
    },
    headers: {
      Authorization: `Bearer ${token}`,
    },
    stamp: true,
    stampPostion: 'headers',
  })

  return `0x${signature}` as Hex
}
