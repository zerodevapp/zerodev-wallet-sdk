/**
 * Node.js MSW server for the ZeroDev KMS backend and Turnkey auth proxy.
 *
 * The Node-compatible counterpart of mock-backend.ts (Playwright page.route()).
 * Both share response factories from mock-responses.ts so payloads never drift.
 *
 * Call `setupNodeMocks()` in `beforeAll` and invoke the returned teardown in
 * `afterAll` to start/stop the server. For per-test handler overrides use the
 * exported `server` directly:
 *
 *   server.use(http.post('https://authproxy.turnkey.com/v1/otp_verify_v2', () =>
 *     HttpResponse.json({ error: 'OTP failed' }, { status: 400 }),
 *   ))
 *   try { ... } finally { server.resetHandlers() }
 */

import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import {
  MOCK_AUTH_PROXY_CONFIG_ID,
  MOCK_OTP_CODE,
  MOCK_OTP_SIGNER_PUBLIC_KEY,
  MOCK_PARENT_ORG_ID,
  MOCK_PROJECT_ID,
  mockResponses,
} from './mock-responses.js'

export {
  MOCK_AUTH_PROXY_CONFIG_ID,
  MOCK_OTP_CODE,
  MOCK_OTP_SIGNER_PUBLIC_KEY,
  MOCK_PARENT_ORG_ID,
  MOCK_PROJECT_ID,
}

export const server = setupServer(
  http.get(/\/server-info\/auth-proxy-id/, () =>
    HttpResponse.json(mockResponses.authProxyId()),
  ),
  http.get(/\/server-info\/parent-org-id/, () =>
    HttpResponse.json(mockResponses.parentOrgId()),
  ),
  http.post(/\/auth\/init\/otp/, () =>
    HttpResponse.json(mockResponses.otpInit()),
  ),
  http.post('https://authproxy.turnkey.com/v1/otp_verify_v2', () =>
    HttpResponse.json(mockResponses.otpVerify()),
  ),
  http.post(/\/auth\/login\/otp/, () =>
    HttpResponse.json(mockResponses.otpLogin()),
  ),
  http.post(/\/auth\/login\/stamp/, () =>
    HttpResponse.json(mockResponses.stampLogin()),
  ),
  http.post(/\/whoami/, () => HttpResponse.json(mockResponses.whoami())),
  http.get(/\/user-wallet/, () =>
    HttpResponse.json(mockResponses.userWallet()),
  ),
  http.post(/\/sign\/message/, () =>
    HttpResponse.json(mockResponses.signMessage()),
  ),
  http.post(/\/sign\/typed-data-v4/, () =>
    HttpResponse.json(mockResponses.signTypedData()),
  ),
)

/**
 * Starts the MSW server to intercept fetch calls in Node.
 *
 * Unhandled requests are passed through (bypass), so real-email-mode calls
 * to Guerrilla Mail and Turnkey are unaffected when tests run in real mode.
 *
 * @returns teardown function — call in `afterAll` to stop the server
 */
export function setupNodeMocks(): () => void {
  server.listen({ onUnhandledRequest: 'bypass' })
  return () => server.close()
}
