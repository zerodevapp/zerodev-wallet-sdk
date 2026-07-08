import { createNewAccount, ping } from './temp-email.js'

export type OtpSession = {
  email: string
  /** Known OTP code in mock mode; null in real-email mode (polled after UI submit). */
  otpCode: string | null
  /** Guerrilla Mail auth token; only set in real-email mode. */
  authToken: string | null
}

/**
 * Pings the email service and creates a temp inbox.
 * Throws if the email service is unavailable — callers handle the skip.
 */
export async function createRealEmailOtpSession(): Promise<OtpSession> {
  await ping()
  const { address, authToken } = await createNewAccount()
  return { email: address, otpCode: null, authToken }
}
