import type { Hex } from 'viem'
import type { Client } from '../../client/types.js'
import {
  buildTurnkeyPayload,
  computeMessagePayloadHash,
  sendSigningRequest,
} from './signingUtils.js'

export type SignMessageParameters = {
  /** The organization ID */
  organizationId: string
  /** The project ID for the request */
  projectId: string
  /** The session token for authorization */
  token: string
  /** The address to sign with */
  address: Hex
  /** The message to sign */
  message: string
  /** The encoding of the message ('utf8' or 'hex') */
  encoding: 'utf8' | 'hex'
}

export type SignMessageReturnType = Hex

export async function signMessage(
  client: Client,
  params: SignMessageParameters,
): Promise<SignMessageReturnType> {
  const { organizationId, projectId, token, address, message, encoding } =
    params

  const payloadHash = computeMessagePayloadHash(message, encoding)
  const turnkeyPayload = buildTurnkeyPayload(
    organizationId,
    address,
    payloadHash,
  )

  return sendSigningRequest(client, {
    projectId,
    token,
    path: 'sign/message',
    turnkeyPayload,
    bodyFields: { message, encoding },
  })
}
