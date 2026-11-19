/**
 * Backend E2E test for the Magic Link authentication flow.
 *
 * Magic link is built on top of the OTP flow. Instead of sending a plain
 * OTP code, Turnkey embeds the code into a clickable URL in the email.
 * The link's URL template is configured per-project on the backend
 * (`wallet.otp_configs.magic_link_template`); the SDK just calls
 * registerWithOTP. This test requires a code inside the magic-link URL, so a
 * project configuration regression cannot pass as a plain-code OTP test.
 *
 * Flow:
 * 1. Create temp email account
 * 2. Register with OTP
 * 3. Extract OTP code from the magic link URL in the email
 * 4. Verify OTP through the backend (verify/otp)
 * 5. Stamp login with the verified session key and the token alias
 * 6. Verify session works (whoami)
 */

import { beforeAll, describe, expect, it } from 'vitest'
import { encryptOtpAttempt } from '../../packages/core/src/utils/encryptOtpAttempt.js'
import { parseSession } from '../../packages/core/src/utils/utils.js'
import {
  EMAIL_POLL_INTERVAL_MS,
  EMAIL_POLL_TIMEOUT_MS,
} from '../helpers/constants.js'
import { extractOtpCodeFromMagicLinkUrl } from '../helpers/otp-utils.js'
import { createNewAccount, searchForNewEmail } from '../helpers/temp-email.js'
import { createTestClient } from '../helpers/test-client.js'
import { createTestStamper } from '../helpers/test-stamper.js'

describe('Magic Link Authentication Flow', () => {
  let projectId: string

  beforeAll(async () => {
    projectId = process.env.ZD_PROJECT_ID || ''
  })

  it('should complete the full magic link register + login flow', async () => {
    // Step 1: Create temp email account
    const emailAccount = await createNewAccount()
    const email = emailAccount.address
    console.log(`Created temp email: ${email}`)

    // Step 2: Create test stamper
    const stamper = createTestStamper()
    const publicKey = await stamper.getPublicKey()
    if (!publicKey) throw new Error('Test stamper returned no public key')

    // Step 3: Create SDK client
    const client = createTestClient(stamper)

    // Step 4: Register with OTP. This project's backend configuration supplies
    // the magic-link template; the client does not choose the delivery format.
    const registerResult = await client.registerWithOTP({
      email,
      contact: { type: 'email', contact: email },
      projectId,
    })
    expect(registerResult.otpId).toBeTruthy()
    expect(registerResult.otpEncryptionTargetBundle).toBeTruthy()
    console.log(`OTP initiated with magic link, otpId: ${registerResult.otpId}`)

    // Step 5: Poll for email and extract OTP code from magic link URL
    console.log('Waiting for magic link email...')
    const emailContent = await searchForNewEmail(
      emailAccount.authToken,
      EMAIL_POLL_INTERVAL_MS,
      EMAIL_POLL_TIMEOUT_MS,
    )
    console.log(`Email content preview: ${emailContent.substring(0, 200)}...`)

    const otpCode = extractOtpCodeFromMagicLinkUrl(emailContent)
    if (!otpCode) throw new Error('Magic-link project sent no code URL')
    console.log(`Extracted OTP code: ${otpCode}`)

    // Step 6: HPKE-seal the OTP attempt and verify through the backend, which
    // returns an alias of the verification token.
    const encryptedOtpBundle = await encryptOtpAttempt({
      otpCode,
      publicKey,
      encryptionTargetBundle: registerResult.otpEncryptionTargetBundle,
    })
    const verifyResult = await client.verifyOTP({
      otpId: registerResult.otpId,
      encryptedOtpBundle,
      projectId,
    })
    expect(verifyResult.verificationToken).toBeTruthy()
    expect(verifyResult.subOrganizationId).toBeTruthy()
    console.log('OTP verified through the backend')

    // Step 7: Stamp login in the user's sub-org with the sealed key, which
    // carries the alias and becomes the session key.
    const loginResult = await client.loginWithStamp({
      projectId,
      organizationId: verifyResult.subOrganizationId,
      targetPublicKey: publicKey,
      sessionToken: verifyResult.verificationToken,
    })
    expect(loginResult.session).toBeTruthy()
    console.log('Magic link stamp login successful')

    // Step 8: Validate session
    const session = parseSession(loginResult.session)
    expect(session.userId).toBeTruthy()
    expect(session.organizationId).toBeTruthy()
    expect(session.sessionType).toBe('SESSION_TYPE_READ_WRITE')
    console.log(
      `Session: userId=${session.userId}, orgId=${session.organizationId}`,
    )

    // Step 9: Verify session works with whoami
    const whoami = await client.getWhoami({
      organizationId: session.organizationId,
      projectId,
      token: loginResult.session,
    })
    expect(whoami.userId).toBeTruthy()
    expect(whoami.organizationId).toBe(session.organizationId)
    console.log(
      `Whoami: userId=${whoami.userId}, orgId=${whoami.organizationId}`,
    )
  })
})
