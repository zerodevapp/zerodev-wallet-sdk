import type { Hex } from 'viem'
import type { Client } from '../../client/types.js'
import {
  buildTurnkeyPayload,
  computeDataPayloadHash,
  sendSigningRequest,
} from './signingUtils.js'

export type SignUserOperationParameters = {
  /** The organization ID */
  organizationId: string
  /** The project ID for the request */
  projectId: string
  /** The session token for authorization */
  token: string
  /** The address to sign with */
  address: Hex
  /** The unsigned user operation to sign */
  unsignedUserOperation: string
  /** The chain ID for the user operation */
  chainId: number
  /** The encoding of the user operation ('utf8' or 'hex') */
  encoding: 'utf8' | 'hex'
}

export type SignUserOperationReturnType = Hex

export async function signUserOperation(
  client: Client,
  params: SignUserOperationParameters,
): Promise<SignUserOperationReturnType> {
  const {
    organizationId,
    projectId,
    token,
    address,
    unsignedUserOperation,
    chainId,
    encoding,
  } = params

  const payloadHash = computeDataPayloadHash(unsignedUserOperation, encoding)
  const turnkeyPayload = buildTurnkeyPayload(
    organizationId,
    address,
    payloadHash,
  )

  return sendSigningRequest(client, {
    projectId,
    token,
    path: 'sign/user-operation',
    turnkeyPayload,
    bodyFields: { unsignedUserOperation, chainId, encoding },
  })
}
