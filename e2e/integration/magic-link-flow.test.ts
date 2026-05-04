/**
 * E2E integration test for the Magic Link authentication flow.
 *
 * Magic link is built on top of the OTP flow. Instead of sending a plain
 * OTP code, Turnkey embeds the code into a clickable URL in the email.
 * The SDK uses registerWithOTP with emailCustomization.magicLinkTemplate
 * where %s is replaced with the OTP code by Turnkey.
 *
 * Flow:
 * 1. Create temp email account
 * 2. Register with OTP + emailCustomization.magicLinkTemplate
 * 3. Extract OTP code from the magic link URL in the email
 * 4. Verify OTP with Auth Proxy
 * 5. Build client signature
 * 6. Login with OTP via backend
 * 7. Verify session works (whoami)
 */

import { beforeAll, describe, expect, it } from 'vitest'
import { createAuthProxyClient } from '../../packages/core/src/client/authProxy.js'
import { buildClientSignature } from '../../packages/core/src/utils/buildClientSignature.js'
import { encryptOtpAttempt } from '../../packages/core/src/utils/encryptOtpAttempt.js'
import { parseSession } from '../../packages/core/src/utils/utils.js'
import {
  getAuthProxyConfigId,
  waitForBackend,
} from '../helpers/backend-health.js'
import {
  BACKEND_URL,
  EMAIL_POLL_INTERVAL_MS,
  EMAIL_POLL_TIMEOUT_MS,
  OTP_CODE_LENGTH,
} from '../helpers/constants.js'
import {
  extractOtpCode,
  extractOtpCodeFromMagicLinkUrl,
} from '../helpers/otp-utils.js'
import {
  createNewAccount,
  ping,
  searchForNewEmail,
} from '../helpers/temp-email.js'
import { createTestClient } from '../helpers/test-client.js'
import { createTestStamper } from '../helpers/test-stamper.js'

// The magic link template URL must have an origin that matches the project's
// ACL security policies. The test client uses Origin: http://localhost:3000
// which should be allowed by the staging project.
const MAGIC_LINK_REDIRECT_URL =
  process.env.MAGIC_LINK_REDIRECT_URL || 'http://localhost:3000/auth/callback'

describe('Magic Link Authentication Flow', () => {
  let projectId: string
  let authProxyConfigId: string
  let skipReason = ''

  beforeAll(async () => {
    try {
      await waitForBackend(BACKEND_URL)
    } catch {
      skipReason = `Backend not reachable at ${BACKEND_URL}`
      return
    }

    try {
      await ping()
    } catch {
      skipReason = 'Email service unavailable'
      return
    }

    authProxyConfigId = await getAuthProxyConfigId(BACKEND_URL)

    projectId = process.env.ZD_PROJECT_ID || ''
    if (!projectId) {
      skipReason = 'ZD_PROJECT_ID not set'
      return
    }
  })

  it('should complete the full magic link register + login flow', async (context) => {
    console.log(`Skipping magic link flow test: ${skipReason}`)
    context.skip(!!skipReason, skipReason)

    // Step 1: Create temp email account
    const emailAccount = await createNewAccount()
    const email = emailAccount.address
    console.log(`Created temp email: ${email}`)

    // Step 2: Create test stamper
    const stamper = createTestStamper()
    const publicKey = await stamper.getPublicKey()
    expect(publicKey).toBeTruthy()

    // Step 3: Create SDK client
    const client = createTestClient(stamper)

    // Step 4: Register with OTP + magic link template
    // The magic link template uses %s as a placeholder for the OTP code.
    // Turnkey will replace %s with the actual code in the email.
    const magicLinkTemplate = `${MAGIC_LINK_REDIRECT_URL}${MAGIC_LINK_REDIRECT_URL.includes('?') ? '&' : '?'}code=%s`
    console.log(`Magic link template: ${magicLinkTemplate}`)

    const registerResult = await client.registerWithOTP({
      email,
      contact: { type: 'email', contact: email },
      projectId,
      emailCustomization: {
        magicLinkTemplate,
      },
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

    // Try extracting from URL first, fall back to plain OTP extraction
    let otpCode = extractOtpCodeFromMagicLinkUrl(emailContent)
    if (!otpCode) {
      console.log(
        'No magic link URL found in email, falling back to plain OTP extraction',
      )
      otpCode = extractOtpCode(emailContent, OTP_CODE_LENGTH)
    }
    expect(otpCode).toBeTruthy()
    console.log(`Extracted OTP code: ${otpCode}`)

    // Step 6: HPKE-seal the OTP attempt and verify with Auth Proxy.
    const encryptedOtpBundle = await encryptOtpAttempt({
      otpCode: otpCode!,
      publicKey: publicKey!,
      encryptionTargetBundle: registerResult.otpEncryptionTargetBundle,
    })
    const authProxyClient = createAuthProxyClient({ authProxyConfigId })
    const verifyResult = await authProxyClient.verifyOtp({
      otpId: registerResult.otpId,
      encryptedOtpBundle,
    })
    expect(verifyResult.verificationToken).toBeTruthy()
    console.log('OTP verified with Auth Proxy')

    // Step 7: Build client signature
    const clientSignature = await buildClientSignature({
      verificationToken: verifyResult.verificationToken,
      publicKey: publicKey!,
      stamper,
    })
    expect(clientSignature).toBeTruthy()
    expect(clientSignature).toHaveLength(128)
    console.log('Client signature built')

    // Step 8: Login with OTP via backend
    const loginResult = await client.loginWithOTP({
      verificationToken: verifyResult.verificationToken,
      clientSignature,
      projectId,
    })
    expect(loginResult.session).toBeTruthy()
    console.log('Magic link login successful')

    // Step 9: Validate session
    const session = parseSession(loginResult.session)
    expect(session.userId).toBeTruthy()
    expect(session.organizationId).toBeTruthy()
    expect(session.sessionType).toBe('SESSION_TYPE_READ_WRITE')
    console.log(
      `Session: userId=${session.userId}, orgId=${session.organizationId}`,
    )

    // Step 10: Verify session works with whoami
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
