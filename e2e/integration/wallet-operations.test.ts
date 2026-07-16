/**
 * E2E integration test for wallet operations after authentication.
 *
 * After OTP login:
 * 1. Get user wallet addresses
 * 2. Sign a message
 *
 * In mock mode all network calls are intercepted by `setupNodeMocks()`;
 * `completeOtpLogin` uses the known test OTP code instead of a real email.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  getAuthProxyConfigId,
  waitForBackend,
} from '../helpers/backend-health.js'
import { BACKEND_URL } from '../helpers/constants.js'
import { isRealEmail } from '../helpers/env-utils.js'
import {
  MOCK_AUTH_PROXY_CONFIG_ID,
  MOCK_PROJECT_ID,
  setupNodeMocks,
} from '../helpers/mock-backend-node.js'
import { completeOtpLogin } from '../helpers/otp-login.js'
import { ping } from '../helpers/temp-email.js'

describe('Wallet Operations', () => {
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

  it('should get user wallet addresses after login', async (context) => {
    context.skip(!!skipReason, skipReason)

    const { client, session, sessionToken } = await completeOtpLogin(
      projectId,
      authProxyConfigId,
    )

    const wallet = await client.getUserWallet({
      organizationId: session.organizationId,
      projectId,
      token: sessionToken,
    })

    expect(wallet.walletAddresses).toBeDefined()
    expect(Array.isArray(wallet.walletAddresses)).toBe(true)
    expect(wallet.walletAddresses.length).toBeGreaterThan(0)

    for (const addr of wallet.walletAddresses) {
      expect(addr).toMatch(/^0x[a-fA-F0-9]{40}$/)
    }

    console.log(`Wallet addresses: ${wallet.walletAddresses.join(', ')}`)
  })

  it('should sign a message after login', async (context) => {
    context.skip(!!skipReason, skipReason)

    const { client, session, sessionToken } = await completeOtpLogin(
      projectId,
      authProxyConfigId,
    )

    const wallet = await client.getUserWallet({
      organizationId: session.organizationId,
      projectId,
      token: sessionToken,
    })
    expect(wallet.walletAddresses.length).toBeGreaterThan(0)
    const walletAddress = wallet.walletAddresses[0]!

    const signature = await client.signMessage({
      organizationId: session.organizationId,
      projectId,
      token: sessionToken,
      address: walletAddress,
      message: 'Hello, World!',
      encoding: 'utf8',
    })

    expect(signature).toBeTruthy()
    expect(typeof signature).toBe('string')
    console.log(
      `Signed message, signature: ${String(signature).substring(0, 20)}...`,
    )
  })
})
