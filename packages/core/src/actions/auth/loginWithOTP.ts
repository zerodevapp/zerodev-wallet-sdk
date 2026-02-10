import type { Client } from '../../client/types.js'

export type LoginWithOTPParameters = {
  /** The verification token JWT from Auth Proxy's verifyOtp */
  verificationToken: string
  /** The raw r||s signature hex (64 bytes = 128 chars) */
  clientSignature: string
  /** The project ID for the request */
  projectId: string
}

export type LoginWithOTPReturnType = {
  /** The Turnkey session token */
  session: string
}

/**
 * Logs in a user with OTP (One-Time Password) authentication via the backend.
 *
 * The backend handles:
 * 1. Parsing the verificationToken JWT to extract email and publicKey
 * 2. Creating/retrieving sub-organization for (projectId, email)
 * 3. Reconstructing the message for signature verification
 * 4. Calling Turnkey.OtpLogin with the appropriate parameters
 * 5. Returning the session to the SDK
 *
 * @param client - The ZeroDev Wallet client
 * @param params - The parameters for OTP login
 * @returns The login result with session token
 *
 * @example
 * ```ts
 * // After verifying OTP via Auth Proxy and building client signature
 * const result = await loginWithOTP(client, {
 *   verificationToken: '<jwt-from-auth-proxy>',
 *   clientSignature: '<raw-signature-hex>',
 *   projectId: 'proj_456'
 * });
 *
 * // Use result.session for authenticated requests
 * ```
 */
export async function loginWithOTP(
  client: Client,
  params: LoginWithOTPParameters,
): Promise<LoginWithOTPReturnType> {
  const { verificationToken, clientSignature, projectId } = params

  return await client.request({
    path: `${projectId}/auth/login/otp`,
    method: 'POST',
    body: {
      verificationToken,
      clientSignature,
    },
  })
}
