import type { Hex } from 'viem'
import type { Client } from '../../client/types.js'
import { AGENT_STAMP_HEADER } from '../../constants.js'
import type { SigningStamper } from '../../stampers/types.js'
import {
  buildTurnkeyPayload,
  computeMessagePayloadHash,
  sendSigningRequest,
} from '../wallet/signingUtils.js'
import type { SignMessageParameters as UserSignMessageParameters } from '../wallet/signMessage.js'

export type SignMessageParameters = Omit<UserSignMessageParameters, 'token'>

export type SignMessageReturnType = Hex

/** Signs a message with a server wallet. Requires the `sign` role. */
export async function signMessage(
  client: Client<undefined, SigningStamper>,
  params: SignMessageParameters,
): Promise<SignMessageReturnType> {
  const { organizationId, projectId, address, message, encoding } = params

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
