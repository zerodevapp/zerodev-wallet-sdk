/**
 * Playwright route mocks for the ZeroDev KMS backend and Turnkey auth proxy.
 *
 * Used when `USE_REAL_EMAIL=false` so that OTP tests can run without hitting
 * the real email service or backend. All routes are intercepted via
 * `page.route()` glob patterns and fulfilled with deterministic fixture data.
 *
 * Route patterns use `**` which Playwright resolves across path separators, so
 * "**\/auth\/init\/otp" matches
 * "https://kms.staging.zerodev.app/api/v1/{projectId}/auth/init/otp".
 */

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Page } from '@playwright/test'
import { createMockSessionJwt } from './mock-session.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const TEST_OTP_CODE = '000000'

function getTestOtpBundle(): string {
  const fixturesDir = path.join(__dirname, '..', 'fixtures')
  return readFileSync(path.join(fixturesDir, 'test-otp-bundle.json'), 'utf-8')
}

/**
 * Registers Playwright route mocks for the full OTP login flow.
 *
 * Intercepts the four network calls the SDK makes during OTP auth:
 *   1. `server-info/auth-proxy-id` — returns a deterministic config ID
 *   2. `auth/init/otp` — returns a mock OTP ID + encrypted bundle fixture
 *   3. Turnkey `otp_verify_v2` — returns a mock verification token
 *   4. `auth/login/otp` — returns a mock session JWT
 *
 * @returns The fixed OTP code the mock expects the test to submit
 */
export async function setupOtpMocks(page: Page): Promise<{ otpCode: string }> {
  const mockSession = createMockSessionJwt()

  await page.route('**/server-info/auth-proxy-id', (route) =>
    route.fulfill({ json: { authProxyConfigId: 'mock-auth-proxy-config-id' } }),
  )

  await page.route('**/auth/init/otp', (route) =>
    route.fulfill({
      json: {
        otpId: 'mock-otp-id-abc123',
        otpEncryptionTargetBundle: getTestOtpBundle(),
      },
    }),
  )

  await page.route('https://authproxy.turnkey.com/v1/otp_verify_v2', (route) =>
    route.fulfill({ json: { verificationToken: 'mock-verification-token' } }),
  )

  await page.route('**/auth/login/otp', (route) =>
    route.fulfill({ json: { session: mockSession } }),
  )

  return { otpCode: TEST_OTP_CODE }
}
