/**
 * Returns true when tests should use a real email service (mail.tm) for OTP
 * delivery. When false, tests are expected to mock the backend routes instead.
 */
export function isRealEmail(): boolean {
  return process.env.USE_REAL_EMAIL === 'true'
}
