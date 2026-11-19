import { canonicalizeEx } from 'json-canonicalize'
import type { Client } from '../../client/types.js'
import type { Stamp, Stamper } from '../../stampers/types.js'
import type { StamperType } from '../../types/session.js'

export type LoginWithStampParameters = {
  /** The project ID for the request */
  projectId: string
  /**
   * The organization the login names: the Turnkey parent org, or the caller's
   * own sub-org. It is signed into the stamp and sent in the body, and the two
   * must match since the backend rebuilds the signed payload from the body.
   */
  organizationId: string
  /** The encoded public key for the request */
  targetPublicKey: string
  /** The stamper type for the request */
  stampWith?: StamperType
  /**
   * Stamps the login with this stamper instead of the client's `stampWith`
   * one, e.g. with the pending key through `apiKeyStamper.stampPending`.
   */
  stamper?: Pick<Stamper, 'stamp'>
  /**
   * The session token the stamp carries: the alias `verifyOTP` returned, which
   * the backend swaps for the verification token before relaying the stamp to
   * Turnkey. Only an API key stamp can carry one.
   */
  sessionToken?: string
}

export type LoginWithStampReturnType = {
  /** The session */
  session: string
}

/**
 * Logs in a user with a stamp
 *
 * A passkey or API key login names the parent org, and the backend resolves
 * the sub-org from the stamped credential. An OTP login names the sub-org
 * `verifyOTP` returned, stamps with the key sealed into the OTP bundle, and
 * carries the verification token's alias as `sessionToken`.
 *
 * @param client - The ZeroDev Wallet client
 * @param params - The parameters for login with a stamp
 * @returns The login result
 *
 * @example
 * ```ts
 * const result = await loginWithStamp(client, {
 *   organizationId: 'org_456',
 *   projectId: 'proj_456',
 *   targetPublicKey: 'encodedPublicKey',
 * });
 * ```
 */
export async function loginWithStamp(
  client: Client,
  params: LoginWithStampParameters,
): Promise<LoginWithStampReturnType> {
  const {
    projectId,
    targetPublicKey,
    organizationId,
    stampWith,
    stamper,
    sessionToken,
  } = params

  const timestampMs = Date.now()
  const timestampMsString = timestampMs.toString()
  const timestampIso = new Date(timestampMs).toISOString()

  const stampPayload = canonicalizeEx({
    organizationId,
    parameters: {
      publicKey: targetPublicKey,
    },
    timestampMs: timestampMsString,
    type: 'ACTIVITY_TYPE_STAMP_LOGIN',
  })
  let stamp: Stamp
  if (stamper) {
    stamp = await stamper.stamp(stampPayload)
  } else if (stampWith === 'passkey') {
    stamp = await client.passkeyStamper.stamp(stampPayload)
  } else {
    stamp = await client.apiKeyStamper.stamp(stampPayload)
  }

  return client.request({
    path: `${projectId}/auth/login/stamp`,
    method: 'POST',
    body: {
      organizationId,
      targetPublicKey,
      timestamp: timestampIso,
      stamp: {
        stampHeaderName: stamp.stampHeaderName,
        stampHeaderValue: stamp.stampHeaderValue,
        ...(sessionToken && { sessionToken }),
      },
    },
  })
}
