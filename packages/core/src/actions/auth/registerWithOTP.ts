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
  /** The OTP ID needed for verification */
  otpId: string
}

/**
 * Initiates OTP (One-Time Password) authentication
 * This will send an OTP code to the specified contact method
 *
 * @param client - The ZeroDev Wallet client
 * @param params - The parameters for OTP initiation
 * @returns The result including otpId needed for verification
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
 * // Use result.otpId for the verification step
 * ```
 */
export async function registerWithOTP(
  client: Client,
  params: RegisterWithOTPParameters,
): Promise<RegisterWithOTPReturnType> {
  const { email, contact, projectId, emailCustomization } = params

  return await client.request({
    path: `${projectId}/auth/init/otp`,
    method: 'POST',
    body: {
      email,
      contact,
      emailCustomization,
    },
  })
}
