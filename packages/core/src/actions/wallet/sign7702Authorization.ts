import type { Hex } from 'viem'
import type { Client } from '../../client/types.js'
import { buildTurnkeyPayload, sendSigningRequest } from './signingUtils.js'

export type Sign7702AuthorizationParameters = {
  /** The organization ID */
  organizationId: string
  /** The project ID for the request */
  projectId: string
  /** The session token for authorization */
  token: string
  /** The address to sign with */
  address: Hex
  /** The chain ID for the 7702 authorization */
  chainId: number
  /** The hashed authorization (hex without 0x prefix) */
  hashedAuthorization: string
}

export type Sign7702AuthorizationReturnType = Hex

export async function sign7702Authorization(
  client: Client,
  params: Sign7702AuthorizationParameters,
): Promise<Sign7702AuthorizationReturnType> {
  const {
    organizationId,
    projectId,
    token,
    address,
    chainId,
    hashedAuthorization,
  } = params

  const turnkeyPayload = buildTurnkeyPayload(
    organizationId,
    address,
    hashedAuthorization,
  )

  return sendSigningRequest(client, {
    projectId,
    token,
    path: 'sign/7702-authorization',
    turnkeyPayload,
    bodyFields: { chainId },
  })
}
