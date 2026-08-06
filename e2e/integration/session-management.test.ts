/**
 * E2E integration test for session management.
 *
 * After OTP login, seed that real session into Core, refresh it, restore it,
 * and prove the replacement key can still sign.
 */

import { beforeAll, describe, expect, it } from 'vitest'
import { createZeroDevWalletCore } from '../../packages/core/src/core/createZeroDevWalletCore.js'
import {
  createStorageManager,
  type StorageAdapter,
} from '../../packages/core/src/storage/manager.js'
import { parseSession } from '../../packages/core/src/utils/utils.js'
import {
  getAuthProxyConfigId,
  getParentOrgId,
  waitForBackend,
} from '../helpers/backend-health.js'
import { BACKEND_URL } from '../helpers/constants.js'
import { completeOtpLogin } from '../helpers/otp-login.js'
import { ping } from '../helpers/temp-email.js'
import { createTestClient } from '../helpers/test-client.js'
import { createTestStamper } from '../helpers/test-stamper.js'

function createMemoryStorage(): StorageAdapter {
  const values = new Map<string, string>()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value)
    },
    removeItem: (key) => {
      values.delete(key)
    },
  }
}

describe('Session Management', () => {
  let projectId: string
  let authProxyConfigId: string
  let parentOrgId: string
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
    parentOrgId = await getParentOrgId(BACKEND_URL)

    projectId = process.env.ZD_OTP_PROJECT_ID || ''
    if (!projectId) {
      skipReason = 'ZD_OTP_PROJECT_ID not set'
      return
    }
  })

  it('refreshes through Core, survives restoration, signs, and revokes the replacement key on logout', async (context) => {
    context.skip(!!skipReason, skipReason)

    const { stamper, session, sessionToken } = await completeOtpLogin(
      projectId,
      authProxyConfigId,
    )
    const initialPublicKey = await stamper.getPublicKey()
    if (!initialPublicKey) throw new Error('Initial stamper has no public key')

    const storage = createMemoryStorage()
    const initialSessionId = 'staging-initial-session'
    await createStorageManager(storage).storeSession(
      {
        id: initialSessionId,
        userId: session.userId,
        organizationId: session.organizationId,
        stamperType: 'apiKey',
        ...(session.sessionType && { sessionType: session.sessionType }),
        token: sessionToken,
        publicKey: initialPublicKey,
        expiry: session.expiry,
        createdAt: Date.now(),
      },
      initialSessionId,
    )

    const coreConfig = {
      projectId,
      organizationId: parentOrgId,
      proxyBaseUrl: BACKEND_URL,
      sessionStorage: storage,
      rpId: 'localhost',
      apiKeyStamper: stamper,
      fetchOptions: { headers: { Origin: 'http://localhost:3000' } },
    }
    const sdk = await createZeroDevWalletCore(coreConfig)

    const refreshed = await sdk.refreshSession()
    if (!refreshed) throw new Error('Core did not return a refreshed session')
    const activePublicKey = await stamper.getPublicKey()
    if (!activePublicKey) throw new Error('Refreshed stamper has no public key')

    const normalizeKey = (key: string) => key.replace(/^0x/, '').toLowerCase()
    expect(refreshed.id).not.toBe(initialSessionId)
    expect(normalizeKey(refreshed.publicKey ?? '')).toBe(
      normalizeKey(activePublicKey),
    )
    expect(normalizeKey(parseSession(refreshed.token).publicKey ?? '')).toBe(
      normalizeKey(activePublicKey),
    )

    const signature = await (await sdk.toAccount()).signMessage({
      message: 'Doorway SDK post-refresh signing check',
    })
    expect(signature).toMatch(/^0x[0-9a-f]{130}$/i)

    const restoredSdk = await createZeroDevWalletCore(coreConfig)
    expect((await restoredSdk.getSession())?.id).toBe(refreshed.id)
    const restoredSignature = await (await restoredSdk.toAccount()).signMessage(
      { message: 'Doorway SDK restored-session signing check' },
    )
    expect(restoredSignature).toMatch(/^0x[0-9a-f]{130}$/i)

    const replacementKeyPair = stamper.getKeyPair()
    if (!replacementKeyPair) throw new Error('Refreshed stamper lost its key')
    const revokedStamper = createTestStamper(replacementKeyPair)

    await sdk.logout()

    await expect(
      createTestClient(revokedStamper).getAuthenticators({
        subOrganizationId: refreshed.organizationId,
        projectId,
        token: refreshed.token,
      }),
    ).rejects.toMatchObject({ status: 401 })
  })
})
