import type { Client } from '../../client/types.js'
import type { EmailCustomization } from './authenticateWithEmail.js'

export type OtpContact = {
  /** The OTP delivery type (currently only 'email' is supported) */
  type: 'email' | 'sms'
  /** The contact information (email address or phone number) */
  contact: string
}

export type RegisterWithOTPParameters = {
  /** The email address to register */
  email: string
  /** The contact information for OTP delivery */
  contact: OtpContact
  /** The project ID for the request */
  projectId: string
  /** Optional email customization settings */
  emailCustomization?: EmailCustomization
}

export type RegisterWithOTPReturnType = {
  /** The user ID */
  userId: string
  /** The wallet address */
  walletAddress: string
  /** The sub-organization ID */
  subOrganizationId: string
  /** The OTP ID needed for login */
  otpId: string
}

/**
 * Registers a user with OTP (One-Time Password) authentication
 * This will send an OTP code to the specified contact method
 *
 * @param client - The ZeroDev Signer client
 * @param params - The parameters for OTP registration
 * @returns The registration result including otpId needed for login
 *
 * @example
 * ```ts
 * const result = await registerWithOTP(client, {
 *   email: 'user@example.com',
 *   contact: {
 *     type: 'email',
 *     contact: 'user@example.com'
 *   },
 *   projectId: 'proj_456'
 * });
 *
 * // Use result.otpId for the login step
 * ```
 */
export async function registerWithOTP(
  client: Client,
  params: RegisterWithOTPParameters,
): Promise<RegisterWithOTPReturnType> {
  const { email, contact, projectId, emailCustomization } = params

  return await client.request({
    path: `${projectId}/auth/register/otp`,
    method: 'POST',
    body: {
      email,
      contact,
      projectId,
      emailCustomization,
    },
  })
}
