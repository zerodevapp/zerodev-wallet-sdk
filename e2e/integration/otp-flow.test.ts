/**
 * E2E integration test for the OTP authentication flow.
 *
 * In real-email mode (USE_REAL_EMAIL=true) tests the complete OTP flow against
 * a real KMS backend + Turnkey. In mock mode all network calls are intercepted
 * by `setupNodeMocks()` and the known test OTP code is used instead.
 *
 * Mirrors the Go E2E test at doorway-kms/testing/e2e/e2e_otp_test.go
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
  OTP_CODE_LENGTH,
} from '../helpers/constants.js'
import { isRealEmail } from '../helpers/env-utils.js'
import {
  MOCK_AUTH_PROXY_CONFIG_ID,
  MOCK_OTP_CODE,
  MOCK_OTP_SIGNER_PUBLIC_KEY,
  MOCK_PROJECT_ID,
  setupNodeMocks,
} from '../helpers/mock-backend-node.js'
import { extractOtpCode } from '../helpers/otp-utils.js'
import {
  createNewAccount,
  ping,
  searchForNewEmail,
} from '../helpers/temp-email.js'
import { createTestClient } from '../helpers/test-client.js'
import { createTestStamper } from '../helpers/test-stamper.js'

describe('OTP Authentication Flow', () => {
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

  it('should complete the full OTP register + login flow', async (context) => {
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

    // Step 2: Create test stamper (Node.js ECDSA P-256 implementation)
    const stamper = createTestStamper()
    const publicKey = await stamper.getPublicKey()
    expect(publicKey).toBeTruthy()
    console.log(`Generated public key: ${publicKey!.substring(0, 16)}...`)

    // Step 3: Create SDK client with test transport (includes Origin header)
    const client = createTestClient(stamper)

    // Step 4: Register with OTP (triggers email send in real mode; mocked in mock mode)
    const registerResult = await client.registerWithOTP({
      email,
      contact: { type: 'email', contact: email },
      projectId,
    })
    expect(registerResult.otpId).toBeTruthy()
    expect(registerResult.otpEncryptionTargetBundle).toBeTruthy()
    console.log(`OTP initiated, otpId: ${registerResult.otpId}`)

    // Step 5: Resolve OTP code — poll email in real mode, use known code in mock mode
    let otpCode: string
    if (isRealEmail()) {
      console.log('Waiting for OTP email...')
      const emailContent = await searchForNewEmail(
        authToken!,
        EMAIL_POLL_INTERVAL_MS,
        EMAIL_POLL_TIMEOUT_MS,
      )
      otpCode = extractOtpCode(emailContent, OTP_CODE_LENGTH)!
    } else {
      otpCode = MOCK_OTP_CODE
    }
    expect(otpCode).toBeTruthy()
    console.log(`OTP code: ${otpCode}`)

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
    expect(clientSignature).toHaveLength(128) // 64 bytes = 128 hex chars
    console.log('Client signature built')

    // Step 8: Login with OTP via backend
    const loginResult = await client.loginWithOTP({
      verificationToken: verifyResult.verificationToken,
      clientSignature,
      projectId,
    })
    expect(loginResult.session).toBeTruthy()
    console.log('OTP login successful')

    // Step 9: Parse and validate session
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

  it('should reject an invalid OTP code', async (context) => {
    context.skip(!!skipReason, skipReason)

    const email = isRealEmail()
      ? (await createNewAccount()).address
      : `mock-${Date.now()}@test.example.com`

    const stamper = createTestStamper()
    const publicKey = await stamper.getPublicKey()
    const client = createTestClient(stamper)

    const registerResult = await client.registerWithOTP({
      email,
      contact: { type: 'email', contact: email },
      projectId,
    })

    const wrongEncryptedBundle = await encryptOtpAttempt({
      otpCode: 'WRONG12',
      publicKey: publicKey!,
      encryptionTargetBundle: registerResult.otpEncryptionTargetBundle,
      dangerouslyOverrideSignerPublicKey: isRealEmail()
        ? undefined
        : MOCK_OTP_SIGNER_PUBLIC_KEY,
    })

    // In mock mode, stack a rejecting interceptor on top of the success one
    // for the duration of this assertion only.
    const teardownRejectMock = isRealEmail()
      ? undefined
      : setupNodeMocks({ rejectOtpVerify: true })

    try {
      const authProxyClient = createAuthProxyClient({ authProxyConfigId })
      await expect(
        authProxyClient.verifyOtp({
          otpId: registerResult.otpId,
          encryptedOtpBundle: wrongEncryptedBundle,
        }),
      ).rejects.toThrow()
    } finally {
      teardownRejectMock?.()
    }
  })
})
