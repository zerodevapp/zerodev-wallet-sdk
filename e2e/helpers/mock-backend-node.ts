/**
 * Node.js fetch interceptor for the ZeroDev KMS backend and Turnkey auth proxy.
 *
 * The Node-compatible counterpart of mock-backend.ts (Playwright page.route()).
 * Used by Vitest integration tests when `USE_REAL_EMAIL` is not `'true'`, so
 * they can run without hitting the real email service or backend.
 *
 * Call `setupNodeMocks()` in `beforeAll` and invoke the returned teardown in
 * `afterAll` to restore the original `globalThis.fetch`.
 */

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  createMockSessionJwt,
  createMockVerificationToken,
} from './mock-session.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const MOCK_PROJECT_ID = 'mock-project-id'
export const MOCK_AUTH_PROXY_CONFIG_ID = 'mock-auth-proxy-config-id'
export const MOCK_PARENT_ORG_ID = 'mock-parent-org-id'
export const MOCK_OTP_CODE = '000000'

/**
 * The public key that signed `test-otp-bundle.json`. Pass as
 * `dangerouslyOverrideSignerPublicKey` to `encryptOtpAttempt` in mock mode
 * so it accepts the test bundle without checking the production pinned key.
 */
export const MOCK_OTP_SIGNER_PUBLIC_KEY: string = readFileSync(
  path.join(__dirname, '..', 'fixtures', 'test-signer-public-key.txt'),
  'utf-8',
).trim()

function getTestOtpBundle(): string {
  return readFileSync(
    path.join(__dirname, '..', 'fixtures', 'test-otp-bundle.json'),
    'utf-8',
  )
}

function jsonResponse(data: object): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

interface NodeMockOptions {
  /**
   * When true, `otp_verify_v2` returns HTTP 400 instead of a verification
   * token. Use in tests that assert OTP rejection behavior. Default: false.
   */
  rejectOtpVerify?: boolean
}

/**
 * Intercepts `globalThis.fetch` to mock KMS and Turnkey endpoints.
 *
 * Mirrors the Playwright `page.route()` patterns from mock-backend.ts but
 * works in Node/Vitest without a browser page. Adds extra endpoints used only
 * by integration tests (whoami, loginWithStamp, parent-org-id).
 *
 * Each call wraps the CURRENT `globalThis.fetch`, so calls can be stacked:
 * call again with different options inside a test and call the returned
 * teardown in `finally` to restore the previous interceptor.
 *
 * @returns teardown function — call in `afterAll` (or `finally`) to restore
 */
export function setupNodeMocks(options: NodeMockOptions = {}): () => void {
  const originalFetch = globalThis.fetch
  const mockSession = createMockSessionJwt()
  const fakeSignature = '0x' + 'ab'.repeat(32) + 'cd'.repeat(32) + '01'

  globalThis.fetch = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : (input as Request).url

    // Health / config
    if (/server-info\/auth-proxy-id/.test(url))
      return jsonResponse({ authProxyConfigId: MOCK_AUTH_PROXY_CONFIG_ID })

    if (/server-info\/parent-org-id/.test(url))
      return jsonResponse({ parentOrgId: MOCK_PARENT_ORG_ID })

    // OTP auth flow
    if (/auth\/init\/otp/.test(url))
      return jsonResponse({
        otpId: 'mock-otp-id-abc123',
        otpEncryptionTargetBundle: getTestOtpBundle(),
      })

    if (/authproxy\.turnkey\.com\/v1\/otp_verify_v2/.test(url)) {
      if (options.rejectOtpVerify) {
        return new Response(
          JSON.stringify({
            error: 'OTP verification failed',
            code: 'INVALID_OTP',
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        )
      }
      return jsonResponse({ verificationToken: createMockVerificationToken() })
    }

    if (/auth\/login\/otp/.test(url))
      return jsonResponse({ session: mockSession })

    // Stamp auth (used by session-management loginWithStamp)
    if (/auth\/login\/stamp/.test(url))
      return jsonResponse({ session: mockSession })

    // Whoami
    if (/\/whoami/.test(url))
      return jsonResponse({
        userId: 'mock-user-id',
        organizationId: 'mock-org-id',
      })

    // Wallet
    if (/\/user-wallet/.test(url))
      return jsonResponse({
        walletAddresses: ['0x000000000000000000000000000000000000dEaD'],
      })

    // Signing
    if (/sign\/message/.test(url))
      return jsonResponse({ signature: fakeSignature })

    if (/sign\/typed-data/.test(url))
      return jsonResponse({ signature: fakeSignature })

    // Pass through anything not matched (e.g. Guerrilla Mail in real mode)
    return originalFetch(input, init)
  }

  return () => {
    globalThis.fetch = originalFetch
  }
}
