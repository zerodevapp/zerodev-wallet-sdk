import type { Client } from '../../client/types.js'

export type VerifyOTPParameters = {
  /** The OTP ID returned by `registerWithOTP` */
  otpId: string
  /**
   * HPKE-sealed bundle containing `{otp_code, public_key}` encrypted to the
   * enclave's per-session target key. Produced by `encryptOtpAttempt`; the
   * public key inside is the session key the verification binds.
   */
  encryptedOtpBundle: string
  /** The project ID for the request */
  projectId: string
}

export type VerifyOTPReturnType = {
  /**
   * An alias of the Turnkey verification token, which never leaves the KMS.
   * Opaque: send it as the `sessionToken` of the session key's stamps (see
   * `loginWithStamp`) and never parse or store it.
   */
  verificationToken: string
  /** The sub-organization of the user with the verified email */
  subOrganizationId: string
  /** The user's ID */
  userId: string
  /** The user's Turnkey user ID */
  turnkeyUserId?: string
  /** The user's wallet addresses */
  walletAddresses: string[]
}

/**
 * Verifies an OTP (One-Time Password) through the backend.
 *
 * The backend relays the sealed OTP attempt to Turnkey, registers the user
 * when the project has none for the verified email, and keeps the resulting
 * verification token. It returns the user's registration with an alias of
 * that token. The session key sealed into the bundle then logs in with
 * `loginWithStamp`, naming the returned `subOrganizationId` and carrying the
 * alias as the stamp's `sessionToken`.
 *
 * Each OTP is tied to the project that sent it and is used once: a successful
 * verification consumes it, a rejected code leaves it to retry.
 *
 * @param client - The ZeroDev Wallet client
 * @param params - The parameters for OTP verification
 * @returns The user's registration and the alias of the verification token
 *
 * @example
 * ```ts
 * const { verificationToken, subOrganizationId } = await verifyOTP(client, {
 *   otpId: 'otp_123',
 *   encryptedOtpBundle: '<sealed-bundle>',
 *   projectId: 'proj_456',
 * });
 * ```
 */
export async function verifyOTP(
  client: Client,
  params: VerifyOTPParameters,
): Promise<VerifyOTPReturnType> {
  const { otpId, encryptedOtpBundle, projectId } = params

  return await client.request({
    path: `${projectId}/auth/verify/otp`,
    method: 'POST',
    body: {
      otpId,
      encryptedOtpBundle,
    },
  })
}
