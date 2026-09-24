import { bytesToHex, concat, type Hex, hexToBytes, stringToBytes } from 'viem'
import type { Client } from '../../client/types.js'
import { AGENT_STAMP_HEADER } from '../../constants.js'
import type { SigningStamper } from '../../stampers/types.js'
import {
  buildTurnkeyPayload,
  computeDataPayloadHash,
  sendSigningRequest,
} from '../wallet/signingUtils.js'

export type SignUserOperationParameters = {
  /** The organization ID */
  organizationId: string
  /** The project ID for the request */
  projectId: string
  /** The address to sign with */
  address: Hex
  /**
   * The user operation hash, 32 bytes. Signed as an EIP-191 personal message,
   * which is what Kernel's ECDSA validator verifies on-chain.
   */
  userOpHash: Hex
  /** The chain the user operation targets. Recorded by the KMS. */
  chainId: number
}

export type SignUserOperationReturnType = Hex

/**
 * Signs a user operation hash with a server wallet. Requires the `sign` role.
 * The KMS accepts only EIP-191 wrapped bytes on this route, so the wrap is
 * applied here and the caller passes the bare hash.
 */
export async function signUserOperation(
  client: Client<undefined, SigningStamper>,
  params: SignUserOperationParameters,
): Promise<SignUserOperationReturnType> {
  const { organizationId, projectId, address, userOpHash, chainId } = params

  const hashBytes = hexToBytes(userOpHash)
  const unsignedUserOperation = bytesToHex(
    concat([
      stringToBytes(`\x19Ethereum Signed Message:\n${hashBytes.length}`),
      hashBytes,
    ]),
  ).slice(2)

  const turnkeyPayload = buildTurnkeyPayload(
    organizationId,
    address,
    computeDataPayloadHash(unsignedUserOperation, 'hex'),
  )

  return sendSigningRequest(client, {
    projectId,
    path: 'server-wallet/sign/user-operation',
    turnkeyPayload,
    bodyFields: { unsignedUserOperation, chainId, encoding: 'hex' },
    outerStampHeader: AGENT_STAMP_HEADER,
  })
}
