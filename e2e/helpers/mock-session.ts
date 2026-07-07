/**
 * Creates a minimal but structurally valid JWT for use in mock backend routes.
 *
 * The payload matches the fields expected by `parseSession()` in
 * `packages/core/src/utils/utils.ts`: `exp`, `public_key`, `session_type`,
 * `user_id`, `organization_id`.
 *
 * Uses `Buffer.from(...).toString('base64url')` rather than `btoa()` because
 * this runs in the Node.js Playwright test-runner process where `Buffer` is
 * natively available and handles the URL-safe encoding without manual
 * character substitution.
 */

type MockSessionOverrides = {
  userId?: string
  organizationId?: string
  sessionType?: string
  publicKey?: string
  exp?: number
}

export function createMockSessionJwt(
  overrides: MockSessionOverrides = {},
): string {
  const payload = {
    user_id: overrides.userId ?? 'mock-user-id',
    organization_id: overrides.organizationId ?? 'mock-org-id',
    session_type: overrides.sessionType ?? 'SESSION_TYPE_READ_WRITE',
    public_key: overrides.publicKey ?? '0'.repeat(66),
    exp: overrides.exp ?? Math.floor(Date.now() / 1000) + 3600,
  }
  const header = Buffer.from(JSON.stringify({ alg: 'ES256' })).toString(
    'base64url',
  )
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${header}.${body}.fakesig`
}
