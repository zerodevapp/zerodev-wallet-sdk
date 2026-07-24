/**
 * Shared Playwright helper: completes an OTP login through the demo app UI and
 * lands on the dashboard. Extracted from post-auth.spec.ts so multiple browser
 * specs can reuse it.
 */

import { expect, type Page } from '@playwright/test'
import { EMAIL_POLL_INTERVAL_MS, EMAIL_POLL_TIMEOUT_MS } from './constants.js'
import { extractOtpCode } from './otp-utils.js'
import { searchForNewEmail } from './temp-email.js'

// Demo app uses 6-digit OTP codes (configured in zerodev-signer-demo).
export const DEMO_APP_OTP_LENGTH = 6

/** Completes OTP login through the UI, landing on the dashboard. */
export async function loginWithOtp(
  page: Page,
  email: string,
  authToken: string,
): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('zd:emailAuthMethod', 'otp')
  })
  await page.goto('/')
  await page.getByPlaceholder('Enter your email').fill(email)
  await page.getByPlaceholder('Enter your email').press('Enter')
  await expect(
    page.getByText(`Enter the code from the email we sent to ${email}`, {
      exact: false,
    }),
  ).toBeVisible({ timeout: 30_000 })

  const emailContent = await searchForNewEmail(
    authToken,
    EMAIL_POLL_INTERVAL_MS,
    EMAIL_POLL_TIMEOUT_MS,
  )
  const otpCode = extractOtpCode(emailContent, DEMO_APP_OTP_LENGTH, true)
  expect(otpCode).toBeTruthy()

  await page.getByLabel('Verification code').fill(otpCode!)
  await page.getByRole('button', { name: /Confirm code/i }).click()

  await page.waitForURL('**/dashboard', { timeout: 60_000 })
  await expect(page.getByText('Your Smart Wallet')).toBeVisible({
    timeout: 60_000,
  })
}
