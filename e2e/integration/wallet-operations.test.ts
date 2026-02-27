/**
 * E2E integration test for wallet operations after authentication.
 *
 * After OTP login:
 * 1. Get user wallet addresses
 * 2. Sign a raw payload
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

/** Helper to complete an OTP login flow */
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

describe('Wallet Operations', () => {
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

  it('should sign a raw payload after login', async (context) => {
    context.skip(!!skipReason, skipReason)

    const { client, session, sessionToken } = await completeOtpLogin(
      projectId,
      authProxyConfigId,
    )

    // First get wallet address
    const wallet = await client.getUserWallet({
      organizationId: session.organizationId,
      projectId,
      token: sessionToken,
    })
    expect(wallet.walletAddresses.length).toBeGreaterThan(0)
    const walletAddress = wallet.walletAddresses[0]!

    // Sign a test payload (32 bytes of zeros as hex)
    const testPayload = '0'.repeat(64)
    const signature = await client.signRawPayload({
      organizationId: session.organizationId,
      projectId,
      token: sessionToken,
      address: walletAddress,
      payload: testPayload,
      encoding: 'PAYLOAD_ENCODING_HEXADECIMAL',
      hashFunction: 'HASH_FUNCTION_NO_OP',
    })

    expect(signature).toBeTruthy()
    expect(typeof signature).toBe('string')
    console.log(
      `Signed payload, signature: ${String(signature).substring(0, 20)}...`,
    )
  })
})
