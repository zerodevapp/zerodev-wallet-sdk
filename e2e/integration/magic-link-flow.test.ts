/**
 * E2E integration test for the Magic Link authentication flow.
 *
 * Magic link is built on top of the OTP flow. Turnkey embeds the OTP code
 * into a clickable URL in the email; the URL template is configured per-project
 * on the backend (`wallet.otp_configs.magic_link_template`).
 *
 * In real-email mode the magic link URL is extracted from the received email.
 * In mock mode all network calls are intercepted by `setupNodeMocks()` and the
 * known test OTP code is used directly.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
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
} from '../helpers/constants.js'
import { isRealEmail } from '../helpers/env-utils.js'
import {
  MOCK_AUTH_PROXY_CONFIG_ID,
  MOCK_OTP_CODE,
  MOCK_OTP_SIGNER_PUBLIC_KEY,
  MOCK_PROJECT_ID,
  setupNodeMocks,
} from '../helpers/mock-backend-node.js'
import { extractOtpCodeFromMagicLinkUrl } from '../helpers/otp-utils.js'
import {
  createNewAccount,
  ping,
  searchForNewEmail,
} from '../helpers/temp-email.js'
import { createTestClient } from '../helpers/test-client.js'
import { createTestStamper } from '../helpers/test-stamper.js'

describe('Magic Link Authentication Flow', () => {
  let projectId: string
  let authProxyConfigId: string
  let skipReason = ''
  let teardownMocks: (() => void) | undefined

  beforeAll(async () => {
    if (!isRealEmail()) {
      teardownMocks = setupNodeMocks()
      projectId = MOCK_PROJECT_ID
      authProxyConfigId = MOCK_AUTH_PROXY_CONFIG_ID
      return
    }

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

  afterAll(() => teardownMocks?.())

  it('should complete the full magic link register + login flow', async (context) => {
    context.skip(!!skipReason, skipReason)

    // Step 1: Create email account (real) or use a placeholder (mock)
    let email: string
    let authToken: string | undefined

    if (isRealEmail()) {
      const emailAccount = await createNewAccount()
      email = emailAccount.address
      authToken = emailAccount.authToken
    } else {
      email = `mock-${Date.now()}@test.example.com`
    }
    console.log(`Using email: ${email}`)

    // Step 2: Create test stamper
    const stamper = createTestStamper()
    const publicKey = await stamper.getPublicKey()
    expect(publicKey).toBeTruthy()

    // Step 3: Create SDK client
    const client = createTestClient(stamper)

    // Step 4: Register with OTP — whether the email carries a magic link or a
    // plain code is configured per-project on the backend
    const registerResult = await client.registerWithOTP({
      email,
      contact: { type: 'email', contact: email },
      projectId,
    })
    expect(registerResult.otpId).toBeTruthy()
    expect(registerResult.otpEncryptionTargetBundle).toBeTruthy()
    console.log(`OTP initiated with magic link, otpId: ${registerResult.otpId}`)

    // Step 5: Resolve OTP code — extract from magic link URL in real mode;
    // use the known mock code in mock mode
    let otpCode: string
    if (isRealEmail()) {
      console.log('Waiting for magic link email...')
      const emailContent = await searchForNewEmail(
        authToken!,
        EMAIL_POLL_INTERVAL_MS,
        EMAIL_POLL_TIMEOUT_MS,
      )
      console.log(`Email content preview: ${emailContent.substring(0, 200)}...`)
      const extracted = extractOtpCodeFromMagicLinkUrl(emailContent)
      expect(extracted).toBeTruthy()
      otpCode = extracted!
    } else {
      otpCode = MOCK_OTP_CODE
    }
    console.log(`Extracted magic link code: ${otpCode}`)

    // Step 6: HPKE-seal the OTP attempt and verify with Auth Proxy
    const encryptedOtpBundle = await encryptOtpAttempt({
      otpCode,
      publicKey: publicKey!,
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
