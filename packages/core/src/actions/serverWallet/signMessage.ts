import type { Hex } from 'viem'
import type { Client } from '../../client/types.js'
import { AGENT_STAMP_HEADER } from '../../constants.js'
import type { SigningStamper } from '../../stampers/types.js'
import {
  buildTurnkeyPayload,
  computeMessagePayloadHash,
  sendSigningRequest,
} from '../wallet/signingUtils.js'
import { resolveOrganizationId } from './resolveOrganizationId.js'

export type SignMessageParameters = {
  /** The wallet set's sub-organization ID. Defaults to the client's `organizationId`. */
  organizationId?: string
  /** The project ID for the request */
  projectId: string
  /** The address to sign with */
  address: Hex
  /** The message to sign */
  message: string
  /** The encoding of the message ('utf8' or 'hex') */
  encoding: 'utf8' | 'hex'
}

export type SignMessageReturnType = Hex

/** Signs a message with a server wallet. Requires the `sign` role. */
export async function signMessage(
  client: Client<undefined, SigningStamper>,
  params: SignMessageParameters,
): Promise<SignMessageReturnType> {
  const { projectId, address, message, encoding } = params
  const organizationId = resolveOrganizationId(client, params, 'signMessage')

  const turnkeyPayload = buildTurnkeyPayload(
    organizationId,
    address,
    computeMessagePayloadHash(message, encoding),
  )

  return sendSigningRequest(client, {
    projectId,
    path: 'server-wallet/sign/message',
    turnkeyPayload,
    bodyFields: { message, encoding },
    outerStampHeader: AGENT_STAMP_HEADER,
  })
}
