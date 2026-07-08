/**
 * E2E integration test for session management.
 *
 * After OTP login:
 * 1. Login with stamp using a new key pair (session refresh)
 * 2. Verify new session works for whoami
 *
 * In mock mode all network calls are intercepted by `setupNodeMocks()`;
 * `completeOtpLogin` uses the known test OTP code instead of a real email.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { parseSession } from '../../packages/core/src/utils/utils.js'
import {
  getAuthProxyConfigId,
  getParentOrgId,
  waitForBackend,
} from '../helpers/backend-health.js'
import { BACKEND_URL } from '../helpers/constants.js'
import { isRealEmail } from '../helpers/env-utils.js'
import {
  MOCK_AUTH_PROXY_CONFIG_ID,
  MOCK_PARENT_ORG_ID,
  MOCK_PROJECT_ID,
  setupNodeMocks,
} from '../helpers/mock-backend-node.js'
import { completeOtpLogin } from '../helpers/otp-login.js'
import { ping } from '../helpers/temp-email.js'
import { createTestClient } from '../helpers/test-client.js'
import { createTestStamper } from '../helpers/test-stamper.js'

describe('Session Management', () => {
  let projectId: string
  let authProxyConfigId: string
  let parentOrgId: string
  let skipReason = ''
  let teardownMocks: (() => void) | undefined

  beforeAll(async () => {
    if (!isRealEmail()) {
      teardownMocks = setupNodeMocks()
      projectId = MOCK_PROJECT_ID
      authProxyConfigId = MOCK_AUTH_PROXY_CONFIG_ID
      parentOrgId = MOCK_PARENT_ORG_ID
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
    parentOrgId = await getParentOrgId(BACKEND_URL)

    projectId = process.env.ZD_PROJECT_ID || ''
    if (!projectId) {
      skipReason = 'ZD_PROJECT_ID not set'
      return
    }
  })

  afterAll(() => teardownMocks?.())

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
    // targeting the NEW public key. The stamp is signed against the PARENT
    // org — the backend relays it to Turnkey under the parent and derives the
    // sub-org from the credential. Signing the sub-org here would make the
    // relayed payload mismatch the signature → Turnkey SIGNATURE_INVALID.
    const stampLoginResult = await client.loginWithStamp({
      projectId,
      organizationId: parentOrgId,
      targetPublicKey: newPublicKey,
    })
    expect(stampLoginResult.session).toBeTruthy()
    console.log('Stamp login successful')

    // Step 5: Parse the new session and verify it. The session itself is still
    // scoped to the user's sub-org (Turnkey assigns it), even though we stamped
    // against the parent.
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
