/**
 * Shared helper: completes an end-to-end OTP login.
 *
 * Used by integration tests that need an authenticated session as a setup
 * step (`session-management`, `wallet-operations`). Handles the full
 * register → (email) → encrypted-verify → login flow.
 *
 * In mock mode (USE_REAL_EMAIL !== 'true') the email steps are skipped and the
 * known test OTP code is used instead. Network calls hit the `globalThis.fetch`
 * interceptor set up by `setupNodeMocks()`.
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
import { isRealEmail } from './env-utils.js'
import {
  MOCK_OTP_CODE,
  MOCK_OTP_SIGNER_PUBLIC_KEY,
} from './mock-backend-node.js'
import { extractOtpCode } from './otp-utils.js'
import { createNewAccount, searchForNewEmail } from './temp-email.js'
import { createTestClient } from './test-client.js'
import { createTestStamper } from './test-stamper.js'

export async function completeOtpLogin(
  projectId: string,
  authProxyConfigId: string,
) {
  const stamper = createTestStamper()
  const publicKey = (await stamper.getPublicKey())!
  const client = createTestClient(stamper)

  let email: string
  let authToken: string | undefined

  if (isRealEmail()) {
    const account = await createNewAccount()
    email = account.address
    authToken = account.authToken
  } else {
    email = `mock-${Date.now()}@test.example.com`
  }

  const registerResult = await client.registerWithOTP({
    email,
    contact: { type: 'email', contact: email },
    projectId,
  })

  let otpCode: string
  if (isRealEmail()) {
    const emailContent = await searchForNewEmail(
      authToken!,
      EMAIL_POLL_INTERVAL_MS,
      EMAIL_POLL_TIMEOUT_MS,
    )
    otpCode = extractOtpCode(emailContent, OTP_CODE_LENGTH)!
  } else {
    otpCode = MOCK_OTP_CODE
  }

  const encryptedOtpBundle = await encryptOtpAttempt({
    otpCode,
    publicKey,
    encryptionTargetBundle: registerResult.otpEncryptionTargetBundle,
    dangerouslyOverrideSignerPublicKey: isRealEmail()
      ? undefined
      : MOCK_OTP_SIGNER_PUBLIC_KEY,
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
