import type { Hex } from 'viem'
import type { Client } from '../../client/types.js'
import { AGENT_STAMP_HEADER } from '../../constants.js'
import type { SigningStamper } from '../../stampers/types.js'
import {
  buildTurnkeyPayload,
  sendSigningRequest,
} from '../wallet/signingUtils.js'
import { resolveOrganizationId } from './resolveOrganizationId.js'

export type SignTypedDataV4Parameters = {
  /** The wallet set's sub-organization ID. Defaults to the client's `organizationId`. */
  organizationId?: string
  /** The project ID for the request */
  projectId: string
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

/** Signs EIP-712 typed data with a server wallet. Requires the `sign` role. */
export async function signTypedDataV4(
  client: Client<undefined, SigningStamper>,
  params: SignTypedDataV4Parameters,
): Promise<SignTypedDataV4ReturnType> {
  const { projectId, address, unsignedTypedDataV4, encoding, typedDataHash } =
    params
  const organizationId = resolveOrganizationId(
    client,
    params,
    'signTypedDataV4',
  )

  const turnkeyPayload = buildTurnkeyPayload(
    organizationId,
    address,
    typedDataHash,
  )

  return sendSigningRequest(client, {
    projectId,
    path: 'server-wallet/sign/typed-data-v4',
    turnkeyPayload,
    bodyFields: { unsignedTypedDataV4, encoding },
    outerStampHeader: AGENT_STAMP_HEADER,
  })
}
