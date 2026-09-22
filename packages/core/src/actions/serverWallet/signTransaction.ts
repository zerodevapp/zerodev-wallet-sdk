import type { Hex } from 'viem'
import type { Client } from '../../client/types.js'
import { AGENT_STAMP_HEADER } from '../../constants.js'
import type { SigningStamper } from '../../stampers/types.js'
import {
  buildTurnkeyPayload,
  computeDataPayloadHash,
  sendSigningRequest,
} from '../wallet/signingUtils.js'
import type { SignTransactionParameters as UserSignTransactionParameters } from '../wallet/signTransaction.js'

export type SignTransactionParameters = Omit<
  UserSignTransactionParameters,
  'token'
>

export type SignTransactionReturnType = Hex

/** Signs a transaction with a server wallet. Requires the `sign` role. */
export async function signTransaction(
  client: Client<undefined, SigningStamper>,
  params: SignTransactionParameters,
): Promise<SignTransactionReturnType> {
  const { organizationId, projectId, address, unsignedTransaction } = params

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
