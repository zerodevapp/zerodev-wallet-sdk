import { canonicalizeEx } from 'json-canonicalize'
import type { Hex } from 'viem'
import { hashMessage, keccak256, toHex } from 'viem'
import type { Client } from '../../client/types.js'

export type TurnkeyPayload = {
  type: string
  timestampMs: string
  organizationId: string
  parameters: {
    signWith: string
    payload: string
    encoding: string
    hashFunction: string
  }
}

export function buildTurnkeyPayload(
  organizationId: string,
  address: Hex,
  payloadHash: string,
): TurnkeyPayload {
  return {
    type: 'ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2',
    timestampMs: Date.now().toString(),
    organizationId,
    parameters: {
      signWith: address,
      payload: payloadHash,
      encoding: 'PAYLOAD_ENCODING_HEXADECIMAL',
      hashFunction: 'HASH_FUNCTION_NO_OP',
    },
  }
}

export async function sendSigningRequest(
  client: Client,
  params: {
    projectId: string
    token: string
    path: string
    turnkeyPayload: TurnkeyPayload
    bodyFields: Record<string, unknown>
  },
): Promise<Hex> {
  const { projectId, token, path, turnkeyPayload, bodyFields } = params

  // Inner stamp over the Turnkey payload (for Turnkey verification)
  const innerBodyString = canonicalizeEx(turnkeyPayload)
  const innerStamp = await client.apiKeyStamper.stamp(innerBodyString)

  // Build full body with inner stamp embedded
  const fullBody = {
    ...bodyFields,
    turnkeyPayload,
    stampHeader: {
      stampHeaderName: innerStamp.stampHeaderName,
      stampHeaderValue: innerStamp.stampHeaderValue,
    },
  }

  // Outer stamp over full body (for KMS middleware)
  const fullBodyString = canonicalizeEx(fullBody)
  const outerStamp = await client.apiKeyStamper.stamp(fullBodyString)

  const { signature } = await client.request({
    path: `${projectId}/${path}`,
    method: 'POST',
    body: fullBody,
    headers: {
      [outerStamp.stampHeaderName]: outerStamp.stampHeaderValue,
      Authorization: `Bearer ${token}`,
    },
  })

  return (signature.startsWith('0x') ? signature : `0x${signature}`) as Hex
}

/**
 * Compute payload hash for message signing (EIP-191).
 * Uses viem's hashMessage directly to guarantee correct EIP-191 hashing.
 */
export function computeMessagePayloadHash(
  message: string,
  encoding: 'utf8' | 'hex',
): string {
  if (encoding === 'utf8') {
    return hashMessage(message).slice(2)
  }
  const hex = message.replace(/^0x/, '')
  return hashMessage({ raw: `0x${hex}` as Hex }).slice(2)
}

/**
 * Compute payload hash for data signing (transaction, user operation).
 * Hashes the raw decoded bytes: keccak256(hexDecode(hexData))
 */
export function computeDataPayloadHash(
  data: string,
  encoding: 'utf8' | 'hex',
): string {
  let hexData: string
  if (encoding === 'utf8') {
    hexData = toHex(data).slice(2)
  } else {
    hexData = data.replace(/^0x/, '')
  }

  return keccak256(`0x${hexData}` as Hex).slice(2)
}
