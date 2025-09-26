import type { Client } from "../../client/types.js";
import type { Hex } from "viem";

export type SignRawPayloadParameters = {
  /** The organization ID */
  organizationId: string;
  /** The project ID for the request */
  projectId: string;
  /** The address to sign with */
  address: Hex;
  /** The payload hash to sign (without 0x prefix) */
  payload: string;
  /** The encoding type */
  encoding?: "PAYLOAD_ENCODING_HEXADECIMAL" | "PAYLOAD_ENCODING_EIP712";
  /** The hash function type */
  hashFunction?: "HASH_FUNCTION_NO_OP";
};

export type SignRawPayloadReturnType =  Hex;

/**
 * Signs a raw payload with the user's wallet
 *
 * @param client - The Doorway client
 * @param params - The parameters for signing
 * @returns The signature
 *
 * @example
 * ```ts
 * const result = await signRawPayload(client, {
 *   organizationId: 'org_123',
 *   projectId: 'proj_456',
 *   address: '0x123...',
 *   payload: 'abc123...',
 * });
 * console.log(result.signature); // '0x...'
 * ```
 */
export async function signRawPayload(
  client: Client,
  params: SignRawPayloadParameters
): Promise<SignRawPayloadReturnType> {
  const {
    organizationId,
    projectId,
    address,
    payload,
    encoding = "PAYLOAD_ENCODING_HEXADECIMAL",
    hashFunction = "HASH_FUNCTION_NO_OP"
  } = params;

  const {signature} = await client.request({
    path: `${projectId}/sign/raw-payload`,
    body: {
      body: {
        type: "ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2",
        timestampMs: new Date().getTime().toString(),
        organizationId,
        parameters: {
          signWith: address,
          payload,
          encoding,
          hashFunction,
        },
      },
      apiUrl: "https://api.turnkey.com/public/v1/submit/sign_raw_payload",
    },
    stamp: true,
  });
  return signature as Hex;
}