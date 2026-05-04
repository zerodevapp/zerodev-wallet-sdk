/**
 * E2E integration test for the OTP authentication flow.
 *
 * Tests the complete OTP flow against a real KMS backend + Turnkey:
 * 1. Create temp email account
 * 2. Register with OTP (sends email)
 * 3. Extract OTP code from email
 * 4. Verify OTP with Auth Proxy
 * 5. Build client signature
 * 6. Login with OTP via backend
 * 7. Verify session works (whoami)
 *
 * Mirrors the Go E2E test at doorway-kms/testing/e2e/e2e_otp_test.go
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

  beforeAll(async () => {
    // Check backend availability first (fast fail)
    try {
      await waitForBackend(BACKEND_URL)
    } catch {
      skipReason = `Backend not reachable at ${BACKEND_URL}`
      return
    }

    // Check email service availability
    try {
      await ping()
    } catch {
      skipReason = 'Email service unavailable'
      return
    }

    // Get auth proxy config ID from backend
    authProxyConfigId = await getAuthProxyConfigId(BACKEND_URL)

    // Get project ID from env
    projectId = process.env.ZD_PROJECT_ID || ''
    if (!projectId) {
      skipReason = 'ZD_PROJECT_ID not set'
      return
    }
  })

  it('should complete the full OTP register + login flow', async (context) => {
    context.skip(!!skipReason, skipReason)

    // Step 1: Create temp email account
    const emailAccount = await createNewAccount()
    const email = emailAccount.address
    console.log(`Created temp email: ${email}`)

    // Step 2: Create test stamper (Node.js ECDSA P-256 implementation)
    const stamper = createTestStamper()
    const publicKey = await stamper.getPublicKey()
    expect(publicKey).toBeTruthy()
    console.log(`Generated public key: ${publicKey!.substring(0, 16)}...`)

    // Step 3: Create SDK client with test transport (includes Origin header)
    const client = createTestClient(stamper)

    // Step 4: Register with OTP (triggers email send)
    const registerResult = await client.registerWithOTP({
      email,
      contact: { type: 'email', contact: email },
      projectId,
      otpCodeCustomization: {
        length: OTP_CODE_LENGTH as 6 | 7 | 8 | 9,
        alphanumeric: false,
      },
    })
    expect(registerResult.otpId).toBeTruthy()
    expect(registerResult.otpEncryptionTargetBundle).toBeTruthy()
    console.log(`OTP initiated, otpId: ${registerResult.otpId}`)

    // Step 5: Poll for email and extract OTP code
    console.log('Waiting for OTP email...')
    const emailContent = await searchForNewEmail(
      emailAccount.authToken,
      EMAIL_POLL_INTERVAL_MS,
      EMAIL_POLL_TIMEOUT_MS,
    )
    const otpCode = extractOtpCode(emailContent, OTP_CODE_LENGTH)
    expect(otpCode).toBeTruthy()
    console.log(`Extracted OTP code: ${otpCode}`)

    // Step 6: HPKE-seal the OTP attempt to the enclave's per-session target
    // key, then verify with Auth Proxy.
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

    // Create temp email
    const emailAccount = await createNewAccount()
    const email = emailAccount.address

    // Create stamper and client
    const stamper = createTestStamper()
    const publicKey = await stamper.getPublicKey()
    const client = createTestClient(stamper)

    // Register with OTP
    const registerResult = await client.registerWithOTP({
      email,
      contact: { type: 'email', contact: email },
      projectId,
      otpCodeCustomization: {
        length: OTP_CODE_LENGTH as 6 | 7 | 8 | 9,
        alphanumeric: false,
      },
    })

    // Try to verify with a wrong code
    const wrongEncryptedBundle = await encryptOtpAttempt({
      otpCode: 'WRONG12',
      publicKey: publicKey!,
      encryptionTargetBundle: registerResult.otpEncryptionTargetBundle,
    })
    const authProxyClient = createAuthProxyClient({ authProxyConfigId })
    await expect(
      authProxyClient.verifyOtp({
        otpId: registerResult.otpId,
        encryptedOtpBundle: wrongEncryptedBundle,
      }),
    ).rejects.toThrow()
  })
})
