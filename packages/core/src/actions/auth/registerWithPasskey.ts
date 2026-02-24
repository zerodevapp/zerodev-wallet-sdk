import type { Client } from '../../client/types.js'

export type EmailCustomization = {
  /** A template for the URL to be used in a magic link button, e.g. `https://dapp.xyz/%s`. The auth bundle will be interpolated into the `%s`. */
  magicLinkTemplate?: string
}

export type RegisterWithPasskeyParameters = {
  /** The project ID for the request */
  projectId: string
  /** The challenge for the request */
  challenge: string
  /** The attestation for the request */
  attestation: {
    attestationObject: string
    clientDataJson: string
    credentialId: string
  }
  /** The encoded public key for the request */
  encodedPublicKey: string
}

export type RegisterWithPasskeyReturnType = {
  /** The user ID */
  userId: string
  /** The wallet address */
  walletAddress: string
  /** The sub-organization ID */
  subOrganizationId: string
}

/**
 * Registers a passkey with the user's wallet
 *
 * @param client - The ZeroDev Wallet client
 * @param params - The parameters for passkey registration
 * @returns The passkey registration result
 *
 * @example
 * ```ts
 * const result = await registerWithPasskey(client, {
 *   projectId: 'proj_456',
 *   challenge: 'challenge',
 *   attestation: {
 *     attestationObject: 'attestationObject',
 *     clientDataJson: 'clientDataJson',
 *     credentialId: 'credentialId'
 *   },
 *   encodedPublicKey: 'encodedPublicKey'
 * });
 * ```
 */
export async function registerWithPasskey(
  client: Client,
  params: RegisterWithPasskeyParameters,
): Promise<RegisterWithPasskeyReturnType> {
  const { projectId, challenge, attestation, encodedPublicKey } = params

  return client.request({
    path: `${projectId}/auth/register/passkey`,
    method: 'POST',
    body: {
      attestation,
      challenge,
      encodedPublicKey,
    },
  })
}
