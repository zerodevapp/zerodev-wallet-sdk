/**
 * Playwright route mocks for the ZeroDev KMS backend and Turnkey auth proxy.
 *
 * Used when `USE_REAL_EMAIL=false` so that OTP tests can run without hitting
 * the real email service or backend. All routes are intercepted via
 * `page.route()` glob patterns and fulfilled with deterministic fixture data.
 *
 * Response payloads are imported from mock-responses.ts — the same module used
 * by mock-backend-node.ts — so both environments always return identical data.
 *
 * Route patterns use `**` which Playwright resolves across path separators, so
 * "**\/auth\/init\/otp" matches
 * "https://kms.staging.zerodev.app/api/v1/{projectId}/auth/init/otp".
 */

import type { Page } from '@playwright/test'
import { MOCK_OTP_CODE, mockResponses } from './mock-responses.js'

export { MOCK_OTP_CODE }

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
  await page.route('**/server-info/auth-proxy-id', (route) =>
    route.fulfill({ json: mockResponses.authProxyId() }),
  )

  await page.route('**/auth/init/otp', (route) =>
    route.fulfill({ json: mockResponses.otpInit() }),
  )

  await page.route('https://authproxy.turnkey.com/v1/otp_verify_v2', (route) =>
    route.fulfill({ json: mockResponses.otpVerify() }),
  )

  await page.route('**/auth/login/otp', (route) =>
    route.fulfill({ json: mockResponses.otpLogin() }),
  )

  // `toViemAccount` calls this to resolve the wallet address after auth.
  // Without the mock it would hit the real backend with a fake token and hang
  // until the request times out (causing the post-auth redirect to stall).
  await page.route('**/user-wallet', (route) =>
    route.fulfill({ json: mockResponses.userWallet() }),
  )

  return { otpCode: MOCK_OTP_CODE }
}

/**
 * Registers Playwright route mocks for ZeroDev KMS signing endpoints.
 *
 * Intercepts the two signing calls the SDK makes after authentication:
 *   1. `sign/message` — returns a fake ECDSA signature
 *   2. `sign/typed-data-v4` — returns a fake ECDSA signature
 *
 * The fake signature is a valid-looking 65-byte (130 hex char) value that
 * satisfies the `0x`-prefixed format the SDK expects.
 *
 * ⚠ What these mocks bypass:
 *   - Session validation — the backend never checks if the user/org exists
 *   - Project configuration — allowed chains, permitted operations, and gas
 *     sponsorship rules are never enforced
 *   - Real cryptographic signing — the returned signature is not valid for
 *     any message and is not tied to any real key or wallet address
 *
 * These mocks are a direct consequence of mocking auth: `setupOtpMocks`
 * returns a fake session JWT, so all subsequent authenticated calls to the
 * real backend would be rejected. Signing mocks are therefore required
 * whenever auth is mocked.
 *
 * The scheduled real-email workflow (USE_REAL_EMAIL=true) covers what mock
 * mode cannot: real session validation, correct wallet address, valid
 * on-chain signatures, and project configuration enforcement.
 */
export async function setupSigningMocks(page: Page): Promise<void> {
  await page.route('**/sign/message', (route) =>
    route.fulfill({ json: mockResponses.signMessage() }),
  )

  await page.route('**/sign/typed-data-v4', (route) =>
    route.fulfill({ json: mockResponses.signTypedData() }),
  )
}
