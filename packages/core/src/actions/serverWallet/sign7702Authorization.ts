import type { Hex } from 'viem'
import type { Client } from '../../client/types.js'
import { AGENT_STAMP_HEADER } from '../../constants.js'
import type { SigningStamper } from '../../stampers/types.js'
import {
  buildTurnkeyPayload,
  sendSigningRequest,
} from '../wallet/signingUtils.js'
import { resolveOrganizationId } from './resolveOrganizationId.js'

export type Sign7702AuthorizationParameters = {
  /** The wallet set's sub-organization ID. Defaults to the client's `organizationId`. */
  organizationId?: string
  /** The project ID for the request */
  projectId: string
  /** The address to sign with */
  address: Hex
  /** The hex-encoded EIP-7702 authorization to be signed (without 0x prefix) */
  unsignedTransaction: string
  /** The hashed authorization (hex without 0x prefix) */
  hashedAuthorization: string
}

export type Sign7702AuthorizationReturnType = Hex

/** Signs an EIP-7702 authorization with a server wallet. Requires the `sign` role. */
export async function sign7702Authorization(
  client: Client<undefined, SigningStamper>,
  params: Sign7702AuthorizationParameters,
): Promise<Sign7702AuthorizationReturnType> {
  const { projectId, address, unsignedTransaction, hashedAuthorization } =
    params
  const organizationId = resolveOrganizationId(
    client,
    params,
    'sign7702Authorization',
  )

  const turnkeyPayload = buildTurnkeyPayload(
    organizationId,
    address,
    hashedAuthorization,
  )

  return sendSigningRequest(client, {
    projectId,
    path: 'server-wallet/sign/7702-authorization',
    turnkeyPayload,
    bodyFields: { unsignedTransaction },
    outerStampHeader: AGENT_STAMP_HEADER,
  })
}
