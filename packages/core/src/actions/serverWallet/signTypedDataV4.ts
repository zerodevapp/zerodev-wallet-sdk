import type { Hex } from 'viem'
import type { Client } from '../../client/types.js'
import { AGENT_STAMP_HEADER } from '../../constants.js'
import type { SigningStamper } from '../../stampers/types.js'
import {
  buildTurnkeyPayload,
  sendSigningRequest,
} from '../wallet/signingUtils.js'
import type { SignTypedDataV4Parameters as UserSignTypedDataV4Parameters } from '../wallet/signTypedDataV4.js'

export type SignTypedDataV4Parameters = Omit<
  UserSignTypedDataV4Parameters,
  'token'
>

export type SignTypedDataV4ReturnType = Hex

/** Signs EIP-712 typed data with a server wallet. Requires the `sign` role. */
export async function signTypedDataV4(
  client: Client<undefined, SigningStamper>,
  params: SignTypedDataV4Parameters,
): Promise<SignTypedDataV4ReturnType> {
  const {
    organizationId,
    projectId,
    address,
    unsignedTypedDataV4,
    encoding,
    typedDataHash,
  } = params

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
