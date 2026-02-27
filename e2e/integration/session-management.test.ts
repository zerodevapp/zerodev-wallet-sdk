/**
 * E2E integration test for session management.
 *
 * After OTP login:
 * 1. Login with stamp using a new key pair (session refresh)
 * 2. Verify new session works for whoami
 */

import { beforeAll, describe, expect, it } from 'vitest'
import { createAuthProxyClient } from '../../packages/core/src/client/authProxy.js'
import { buildClientSignature } from '../../packages/core/src/utils/buildClientSignature.js'
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

/** Helper to complete an OTP login flow, returning the session and org ID */
async function completeOtpLogin(projectId: string, authProxyConfigId: string) {
  const emailAccount = await createNewAccount()
  const stamper = createTestStamper()
  const publicKey = (await stamper.getPublicKey())!

  const client = createTestClient(stamper)

  const registerResult = await client.registerWithOTP({
    email: emailAccount.address,
    contact: { type: 'email', contact: emailAccount.address },
    projectId,
    otpCodeCustomization: {
      length: OTP_CODE_LENGTH as 6 | 7 | 8 | 9,
      alphanumeric: false,
    },
  })

  const emailContent = await searchForNewEmail(
    emailAccount.authToken,
    EMAIL_POLL_INTERVAL_MS,
    EMAIL_POLL_TIMEOUT_MS,
  )
  const otpCode = extractOtpCode(emailContent, OTP_CODE_LENGTH)!

  const authProxyClient = createAuthProxyClient({ authProxyConfigId })
  const verifyResult = await authProxyClient.verifyOtp({
    otpId: registerResult.otpId,
    otpCode,
    public_key: publicKey,
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

describe('Session Management', () => {
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

  it('should refresh session via loginWithStamp with a new key pair', async (context) => {
    context.skip(!!skipReason, skipReason)

    // Step 1: Complete initial OTP login
    const { client, session, sessionToken } = await completeOtpLogin(
      projectId,
      authProxyConfigId,
    )
    console.log(`Initial login: orgId=${session.organizationId}`)

    // Step 2: Verify initial session works
    const whoami1 = await client.getWhoami({
      organizationId: session.organizationId,
      projectId,
      token: sessionToken,
    })
    expect(whoami1.userId).toBeTruthy()

    // Step 3: Create a new stamper (new key pair) for session refresh
    const newStamper = createTestStamper()
    const newPublicKey = (await newStamper.getPublicKey())!

    // Step 4: Login with stamp using the OLD stamper (active session key)
    // targeting the NEW public key
    const stampLoginResult = await client.loginWithStamp({
      projectId,
      organizationId: session.organizationId,
      targetPublicKey: newPublicKey,
    })
    expect(stampLoginResult.session).toBeTruthy()
    console.log('Stamp login successful')

    // Step 5: Parse the new session and verify it
    const newSession = parseSession(stampLoginResult.session)
    expect(newSession.userId).toBeTruthy()
    expect(newSession.organizationId).toBe(session.organizationId)
    expect(newSession.sessionType).toBe('SESSION_TYPE_READ_WRITE')
    console.log(`Refreshed session: userId=${newSession.userId}`)

    // Step 6: Create a new client with the new stamper and verify it works
    const newClient = createTestClient(newStamper)

    const whoami2 = await newClient.getWhoami({
      organizationId: newSession.organizationId,
      projectId,
      token: stampLoginResult.session,
    })
    expect(whoami2.userId).toBe(whoami1.userId)
    expect(whoami2.organizationId).toBe(session.organizationId)
    console.log('New session verified with whoami')
  })
})
