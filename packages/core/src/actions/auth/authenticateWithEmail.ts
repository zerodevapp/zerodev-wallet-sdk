import type { Client } from '../../client/types.js'

export type AuthenticateWithEmailParameters = {
  /** The email address to authenticate */
  email: string
  /** The project ID for the request */
  projectId: string
  /** Target public key for authentication */
  targetPublicKey: string
}

export type AuthenticateWithEmailReturnType = {
  /** The user ID */
  userId?: string
  /** The wallet address */
  walletAddress?: string
  /** The sub-organization ID */
  subOrganizationId?: string
  /** Whether magic link is required */
  requiresMagicLink?: boolean
  /** The Turnkey session if available */
  turnkeySession?: string
}

/**
 * @deprecated Use {@link registerWithOTP} instead
 * See {@link registerWithOTP} for more details on how to authenticate with email.
 */
export async function authenticateWithEmail(
  client: Client,
  params: AuthenticateWithEmailParameters,
): Promise<AuthenticateWithEmailReturnType> {
  const { email, projectId, targetPublicKey } = params

  return await client.request({
    path: `${projectId}/auth/email-magic`,
    method: 'POST',
    body: {
      email,
      targetPublicKey,
      projectId,
    },
  })
}
