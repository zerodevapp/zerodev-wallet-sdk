/**
 * Guards against silent drift between `test-otp-bundle.json` and the live backend.
 *
 * `test-otp-bundle.json` is a static fixture used in mock mode. If the backend
 * changes the bundle structure (new fields, removed fields, different encoding),
 * mock-mode tests keep passing because the mock always returns the same fixture.
 * This test catches that drift by comparing the fixture's key structure against
 * a fresh bundle from the real backend.
 *
 * Skipped in mock mode — it requires a live `auth/init/otp` response by design.
 * Runs automatically in the scheduled real-email workflow (USE_REAL_EMAIL=true).
 *
 * No email inbox needed: we call `registerWithOTP` with a fixed dummy address
 * to get the bundle. We never poll for the OTP, so no Guerrilla Mail calls are
 * made and there is no rate-limit risk from this test.
 */

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'
import { waitForBackend } from '../helpers/backend-health.js'
import { BACKEND_URL } from '../helpers/constants.js'
import { isRealEmail } from '../helpers/env-utils.js'
import { createTestClient } from '../helpers/test-client.js'
import { createTestStamper } from '../helpers/test-stamper.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

describe.skipIf(!isRealEmail())('OTP bundle fixture shape', () => {
  let projectId: string
  let skipReason = ''

  beforeAll(async () => {
    try {
      await waitForBackend(BACKEND_URL)
    } catch {
      skipReason = `Backend not reachable at ${BACKEND_URL}`
      return
    }

    projectId = process.env.ZD_PROJECT_ID ?? ''
    if (!projectId) {
      skipReason = 'ZD_PROJECT_ID not set'
    }
  })

  it('fixture keys match the live backend bundle', async (context) => {
    context.skip(!!skipReason, skipReason)

    const client = createTestClient(createTestStamper())
    const result = await client.registerWithOTP({
      email: 'fixture-shape-check@example.com',
      contact: {
        type: 'email',
        contact: 'fixture-shape-check@example.com',
      },
      projectId,
    })

    const liveBundle = JSON.parse(result.otpEncryptionTargetBundle)
    const fixture = JSON.parse(
      readFileSync(
        path.join(__dirname, '..', 'fixtures', 'test-otp-bundle.json'),
        'utf-8',
      ),
    )

    expect(
      Object.keys(liveBundle).sort(),
      'Top-level bundle keys have drifted — regenerate test-otp-bundle.json with e2e/scripts/generate-test-otp-bundle.ts',
    ).toEqual(Object.keys(fixture).sort())

    // The `data` field is hex-encoded JSON containing the enclave's ephemeral
    // public key and org ID. Decode and compare inner keys too.
    const liveData = JSON.parse(
      Buffer.from(liveBundle.data, 'hex').toString('utf-8'),
    )
    const fixtureData = JSON.parse(
      Buffer.from(fixture.data, 'hex').toString('utf-8'),
    )

    expect(
      Object.keys(liveData).sort(),
      'Inner bundle.data keys have drifted — regenerate test-otp-bundle.json with e2e/scripts/generate-test-otp-bundle.ts',
    ).toEqual(Object.keys(fixtureData).sort())
  })
})
