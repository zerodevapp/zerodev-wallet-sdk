import type { Client } from '../../client/types.js'
import type { Stamp } from '../../stampers/types.js'

export type EmailCustomization = {
  /** A template for the URL to be used in a magic link button, e.g. `https://dapp.xyz/%s`. The auth bundle will be interpolated into the `%s`. */
  magicLinkTemplate?: string
}

export type LoginWithStampParameters = {
  /** The project ID for the request */
  projectId: string
  /** The organization ID for the request */
  organizationId: string
  /** The encoded public key for the request */
  targetPublicKey: string
  /** The stamper type for the request */
  stampWith?: 'indexedDb' | 'webauthn'
}

export type LoginWithStampReturnType = {
  /** The session */
  session: string
}

/**
 * Logs in a user with a stamp
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
  const { projectId, targetPublicKey, organizationId, stampWith } = params

  const timestampMs = Date.now()
  const timestampMsString = timestampMs.toString()
  const timestampIso = new Date(timestampMs).toISOString()

  const stampPayload = `${JSON.stringify({
    organizationId,
    parameters: {
      publicKey: targetPublicKey,
    },
    timestampMs: timestampMsString,
    type: 'ACTIVITY_TYPE_STAMP_LOGIN',
  })}\n`
  let stamp: Stamp
  if (stampWith === 'indexedDb') {
    stamp = await client.indexedDbStamper.stamp(stampPayload)
  } else if (stampWith === 'webauthn') {
    stamp = await client.webauthnStamper.stamp(stampPayload)
  } else {
    stamp = await client.indexedDbStamper.stamp(stampPayload)
  }

  return client.request({
    path: `${projectId}/auth/login/passkey`,
    method: 'POST',
    body: {
      subOrganizationId: organizationId,
      targetPublicKey,
      timestamp: timestampIso,
      stamp,
    },
  })
}
