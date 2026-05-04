/**
 * Smoke test: verifies the new `otpEncryptionTargetBundle` is returned by
 * `/auth/init/otp` and that `encryptOtpAttempt` accepts a real bundle signed
 * by the production TLS Fetcher key (no `dangerouslyOverrideSignerPublicKey`).
 *
 * Doesn't require email service — only the backend on `upgrade_turnkey` and a
 * test project. Skipped without ZD_PROJECT_ID set.
 */

import { beforeAll, describe, expect, it } from 'vitest'
import { encryptOtpAttempt } from '../../packages/core/src/utils/encryptOtpAttempt.js'
import { waitForBackend } from '../helpers/backend-health.js'
import { BACKEND_URL } from '../helpers/constants.js'

describe('OTP init wire shape', () => {
  let projectId: string
  let skipReason = ''

  beforeAll(async () => {
    try {
      await waitForBackend(BACKEND_URL)
    } catch {
      skipReason = `Backend not reachable at ${BACKEND_URL}`
      return
    }
    projectId = process.env.ZD_PROJECT_ID || ''
    if (!projectId) {
      skipReason = 'ZD_PROJECT_ID not set'
      return
    }
  })

  it('returns otpEncryptionTargetBundle that encryptOtpAttempt accepts under the production pinned key', async (context) => {
    context.skip(!!skipReason, skipReason)

    const res = await fetch(`${BACKEND_URL}/${projectId}/auth/init/otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:3000',
      },
      body: JSON.stringify({
        email: `smoke-${Date.now()}@example.com`,
        contact: {
          type: 'email',
          contact: `smoke-${Date.now()}@example.com`,
        },
        otpCodeCustomization: { length: 7, alphanumeric: false },
      }),
    })
    expect(res.ok).toBe(true)
    const body = await res.json()

    expect(body.otpId).toBeTruthy()
    expect(body.otpEncryptionTargetBundle).toBeTruthy()

    const envelope = JSON.parse(body.otpEncryptionTargetBundle)
    expect(envelope.version).toBe('v1.0.0')
    expect(typeof envelope.data).toBe('string')
    expect(typeof envelope.dataSignature).toBe('string')
    expect(typeof envelope.enclaveQuorumPublic).toBe('string')

    // Encrypt under the production pinned signer key (no test override). If
    // this throws, either the production key is rotated and we need to update
    // TURNKEY_TLS_FETCHER_SIGN_PUBLIC_KEY, or the bundle is malformed.
    const encrypted = await encryptOtpAttempt({
      otpCode: '0000000',
      publicKey:
        '02aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899',
      encryptionTargetBundle: body.otpEncryptionTargetBundle,
    })
    const parsed = JSON.parse(encrypted)
    expect(typeof parsed.encappedPublic).toBe('string')
    expect(parsed.encappedPublic.length).toBe(130) // 65 bytes uncompressed
    expect(parsed.encappedPublic.slice(0, 2)).toBe('04')
    expect(typeof parsed.ciphertext).toBe('string')
  })
})
