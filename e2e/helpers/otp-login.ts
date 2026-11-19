/**
 * Shared helper: completes an end-to-end OTP login against a real backend.
 *
 * Used by backend e2e tests that need an authenticated session as a setup
 * step (`session-management`, `wallet-operations`). Handles the full
 * register → email → encrypted verify → stamp login flow and returns the
 * authenticated client + session.
 */

import { encryptOtpAttempt } from '../../packages/core/src/utils/encryptOtpAttempt.js'
import { parseSession } from '../../packages/core/src/utils/utils.js'
import {
  EMAIL_POLL_INTERVAL_MS,
  EMAIL_POLL_TIMEOUT_MS,
  OTP_CODE_LENGTH,
} from './constants.js'
import { extractOtpCode, extractOtpCodeFromMagicLinkUrl } from './otp-utils.js'
import { createNewAccount, searchForNewEmail } from './temp-email.js'
import { createTestClient } from './test-client.js'
import { createTestStamper } from './test-stamper.js'

export async function completeOtpLogin(projectId: string) {
  const emailAccount = await createNewAccount()
  const stamper = createTestStamper()
  const publicKey = await stamper.getPublicKey()
  if (!publicKey) throw new Error('Test stamper did not produce a public key')

  const client = createTestClient(stamper)

  const registerResult = await client.registerWithOTP({
    email: emailAccount.address,
    contact: { type: 'email', contact: emailAccount.address },
    projectId,
  })

  const emailContent = await searchForNewEmail(
    emailAccount.authToken,
    EMAIL_POLL_INTERVAL_MS,
    EMAIL_POLL_TIMEOUT_MS,
  )
  if (extractOtpCodeFromMagicLinkUrl(emailContent)) {
    throw new Error('Plain-OTP project unexpectedly sent a magic-link email')
  }
  const otpCode = extractOtpCode(emailContent, OTP_CODE_LENGTH)
  if (!otpCode) throw new Error('OTP email did not contain a verification code')

  const encryptedOtpBundle = await encryptOtpAttempt({
    otpCode,
    publicKey,
    encryptionTargetBundle: registerResult.otpEncryptionTargetBundle,
  })

  // The backend verifies on Turnkey and returns the registration with an alias
  // of the verification token, which the session key's stamps carry.
  const { verificationToken, subOrganizationId } = await client.verifyOTP({
    otpId: registerResult.otpId,
    encryptedOtpBundle,
    projectId,
  })

  // The sealed key stamps the login and becomes the session key, as the SDK
  // core does with its pending key.
  const loginResult = await client.loginWithStamp({
    projectId,
    organizationId: subOrganizationId,
    targetPublicKey: publicKey,
    sessionToken: verificationToken,
  })

  const session = parseSession(loginResult.session)
  return { client, stamper, session, sessionToken: loginResult.session }
}
