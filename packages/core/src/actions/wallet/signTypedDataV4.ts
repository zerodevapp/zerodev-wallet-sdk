import type { Hex } from 'viem'
import type { Client } from '../../client/types.js'
import {
  buildTurnkeyPayload,
  computeDataPayloadHash,
  sendSigningRequest,
} from './signingUtils.js'

export type SignTypedDataV4Parameters = {
  /** The organization ID */
  organizationId: string
  /** The project ID for the request */
  projectId: string
  /** The session token for authorization */
  token: string
  /** The address to sign with */
  address: Hex
  /** The serialized EIP-712 typed data to sign */
  unsignedTypedDataV4: string
  /** The encoding of the typed data ('utf8' or 'hex') */
  encoding: 'utf8' | 'hex'
}

export type SignTypedDataV4ReturnType = Hex

export async function signTypedDataV4(
  client: Client,
  params: SignTypedDataV4Parameters,
): Promise<SignTypedDataV4ReturnType> {
  const {
    organizationId,
    projectId,
    token,
    address,
    unsignedTypedDataV4,
    encoding,
  } = params

  const payloadHash = computeDataPayloadHash(unsignedTypedDataV4, encoding)
  const turnkeyPayload = buildTurnkeyPayload(
    organizationId,
    address,
    payloadHash,
  )

  return sendSigningRequest(client, {
    projectId,
    token,
    path: 'sign/typed-data-v4',
    turnkeyPayload,
    bodyFields: { unsignedTypedDataV4, encoding },
  })
}
