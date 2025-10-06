import type { Client } from '../../client/types.js'

export type LoginWithOTPParameters = {
  /** The OTP ID received from registration */
  otpId: string
  /** The OTP code received via email/sms */
  otpCode: string
  /** The sub-organization ID from registration */
  subOrganizationId: string
  /** The encoded public key for authentication */
  encodedPublicKey: string
  /** The project ID for the request */
  projectId: string
}

export type LoginWithOTPReturnType = {
  /** The Turnkey session token */
  session: string
}

/**
 * Logs in a user with OTP (One-Time Password) authentication
 * This verifies the OTP code and returns a session token
 *
 * @param client - The Doorway client
 * @param params - The parameters for OTP login
 * @returns The login result with session token
 *
 * @example
 * ```ts
 * // After receiving OTP code via email
 * const result = await loginWithOTP(client, {
 *   otpId: 'otp_123456',
 *   otpCode: '123456',
 *   subOrganizationId: 'org_abc',
 *   encodedPublicKey: '0x...',
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
  const { otpId, otpCode, subOrganizationId, encodedPublicKey, projectId } =
    params

  return await client.request({
    path: `${projectId}/auth/login/otp`,
    method: 'POST',
    body: {
      otpId,
      otpCode,
      subOrganizationId,
      encodedPublicKey,
    },
  })
}
