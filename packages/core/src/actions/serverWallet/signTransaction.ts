import type { Hex } from 'viem'
import type { Client } from '../../client/types.js'
import { AGENT_STAMP_HEADER } from '../../constants.js'
import type { SigningStamper } from '../../stampers/types.js'
import {
  buildTurnkeyPayload,
  computeDataPayloadHash,
  sendSigningRequest,
} from '../wallet/signingUtils.js'
import { resolveOrganizationId } from './resolveOrganizationId.js'

export type SignTransactionParameters = {
  /** The wallet set's sub-organization ID. Defaults to the client's `organizationId`. */
  organizationId?: string
  /** The project ID for the request */
  projectId: string
  /** The address to sign with */
  address: Hex
  /** The unsigned transaction to sign (hex without 0x prefix) */
  unsignedTransaction: string
}

export type SignTransactionReturnType = Hex

/** Signs a transaction with a server wallet. Requires the `sign` role. */
export async function signTransaction(
  client: Client<undefined, SigningStamper>,
  params: SignTransactionParameters,
): Promise<SignTransactionReturnType> {
  const { projectId, address, unsignedTransaction } = params
  const organizationId = resolveOrganizationId(
    client,
    params,
    'signTransaction',
  )

  const turnkeyPayload = buildTurnkeyPayload(
    organizationId,
    address,
    computeDataPayloadHash(unsignedTransaction, 'hex'),
  )

  return sendSigningRequest(client, {
    projectId,
    path: 'server-wallet/sign/transaction',
    turnkeyPayload,
    bodyFields: { unsignedTransaction },
    outerStampHeader: AGENT_STAMP_HEADER,
  })
}
