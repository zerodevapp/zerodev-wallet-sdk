import type { Hex } from 'viem'
import type { Client } from '../../client/types.js'
import {
  buildTurnkeyPayload,
  computeDataPayloadHash,
  sendSigningRequest,
} from './signingUtils.js'

export type SignTransactionParameters = {
  /** The organization ID */
  organizationId: string
  /** The project ID for the request */
  projectId: string
  /** The session token for authorization */
  token: string
  /** The address to sign with */
  address: Hex
  /** The unsigned transaction to sign (hex without 0x prefix) */
  unsignedTransaction: string
}

export type SignTransactionReturnType = Hex

export async function signTransaction(
  client: Client,
  params: SignTransactionParameters,
): Promise<SignTransactionReturnType> {
  const { organizationId, projectId, token, address, unsignedTransaction } =
    params

  const payloadHash = computeDataPayloadHash(unsignedTransaction, 'hex')
  const turnkeyPayload = buildTurnkeyPayload(
    organizationId,
    address,
    payloadHash,
  )

  return sendSigningRequest(client, {
    projectId,
    token,
    path: 'sign/transaction',
    turnkeyPayload,
    bodyFields: { unsignedTransaction },
  })
}
