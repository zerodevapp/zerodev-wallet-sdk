import type { Hex } from 'viem'
import type { Client } from '../../client/types.js'
import type { SigningStamper } from '../../stampers/types.js'
import {
  buildTurnkeyPayload,
  computeDataPayloadHash,
  sendSigningRequest,
} from '../wallet/signingUtils.js'
import type { SignUserOperationParameters as UserSignUserOperationParameters } from '../wallet/signUserOperation.js'

export type SignUserOperationParameters = Omit<
  UserSignUserOperationParameters,
  'token'
>

export type SignUserOperationReturnType = Hex

/** Signs a user operation with a server wallet. Requires the `sign` role. */
export async function signUserOperation(
  client: Client<undefined, SigningStamper>,
  params: SignUserOperationParameters,
): Promise<SignUserOperationReturnType> {
  const {
    organizationId,
    projectId,
    address,
    unsignedUserOperation,
    chainId,
    encoding,
  } = params

  const turnkeyPayload = buildTurnkeyPayload(
    organizationId,
    address,
    computeDataPayloadHash(unsignedUserOperation, encoding),
  )

  return sendSigningRequest(client, {
    projectId,
    path: 'server-wallet/sign/user-operation',
    turnkeyPayload,
    bodyFields: { unsignedUserOperation, chainId, encoding },
  })
}
