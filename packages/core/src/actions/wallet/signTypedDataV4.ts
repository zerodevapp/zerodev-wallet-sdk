import type { Hex } from 'viem'
import type { Client } from '../../client/types.js'
import { buildTurnkeyPayload, sendSigningRequest } from './signingUtils.js'

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
  /** Pre-computed EIP-712 hash (hex without 0x prefix), used as the Turnkey payload. */
  typedDataHash: string
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
    typedDataHash,
  } = params

  const payloadHash = typedDataHash
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
