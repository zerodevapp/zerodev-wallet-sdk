/**
 * Extracts an OTP code from email content.
 * Port of extractOtpCode from doorway-kms/testing/e2e/e2e_otp_test.go
 *
 * @param content - The email text content
 * @param length - The expected OTP code length
 * @param digitsOnly - If true, only match digit-only codes (for alphanumeric: false)
 * @returns The extracted OTP code, or null if not found
 */
export function extractOtpCode(
  content: string,
  length: number,
  digitsOnly = false,
): string | null {
  const charClass = digitsOnly ? '[0-9]' : '[A-Z0-9]'
  const re = new RegExp(`${charClass}{${length}}`)
  const match = content.match(re)
  return match ? match[0] : null
}

/**
 * Extracts an auth credentials code from a legacy magic link email.
 * Port of extractAuthCredentialsCode from doorway-kms/testing/e2e/e2e_email_test.go
 *
 * Legacy magic link emails contain a long alphanumeric credential string (100+ chars).
 *
 * @param content - The email text content
 * @returns The extracted credentials code, or null if not found
 */
export function extractMagicLinkCode(content: string): string | null {
  const re = /[a-zA-Z0-9]{100,}/
  const match = content.match(re)
  return match ? match[0] : null
}

/**
 * Extracts the OTP code from a magic link URL in email content.
 *
 * When a project is configured with a magic-link template, Turnkey sends
 * an email containing a URL with the OTP code embedded as a query parameter.
 * For example, with template "http://localhost:3000/verify?code=%s",
 * the email will contain "http://localhost:3000/verify?code=1234567". The
 * host/path are whatever the project's magic_link_template specifies.
 *
 * @param content - The email text content
 * @returns The extracted OTP code, or null if not found
 */
export function extractOtpCodeFromMagicLinkUrl(content: string): string | null {
  // Look for code= query parameter value in URLs
  const match = content.match(/[?&]code=([A-Za-z0-9]+)/)
  return match ? match[1] : null
}

/**
 * Extracts the full magic-link verification URL from email content — the actual
 * link the user would click, including whatever host/path the project's
 * magic_link_template specifies. Returns the first URL carrying a `code=` query
 * parameter, or null.
 */
export function extractMagicLinkUrl(content: string): string | null {
  const urls = content.match(/https?:\/\/[^\s"'<>]+/g) ?? []
  return urls.find((url) => /[?&]code=[A-Za-z0-9]+/.test(url)) ?? null
}
