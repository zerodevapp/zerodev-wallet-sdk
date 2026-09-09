/**
 * Shared helper: completes an end-to-end OTP login against a real backend.
 *
 * Used by backend e2e tests that need an authenticated session as a setup
 * step (`session-management`, `wallet-operations`). Handles the full
 * register → email → encrypted-verify → login flow and returns the
 * authenticated client + session.
 */

import { createAuthProxyClient } from '../../packages/core/src/client/authProxy.js'
import { buildClientSignature } from '../../packages/core/src/utils/buildClientSignature.js'
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

export async function completeOtpLogin(
  projectId: string,
  authProxyConfigId: string,
) {
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

  const authProxyClient = createAuthProxyClient({ authProxyConfigId })
  const verifyResult = await authProxyClient.verifyOtp({
    otpId: registerResult.otpId,
    encryptedOtpBundle,
  })

  const clientSignature = await buildClientSignature({
    verificationToken: verifyResult.verificationToken,
    publicKey,
    stamper,
  })

  const loginResult = await client.loginWithOTP({
    verificationToken: verifyResult.verificationToken,
    clientSignature,
    projectId,
  })

  const session = parseSession(loginResult.session)
  return { client, stamper, session, sessionToken: loginResult.session }
}
