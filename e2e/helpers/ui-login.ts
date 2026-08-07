/**
 * Shared Playwright helper: completes an OTP login through the demo app UI and
 * lands on the dashboard. Extracted from post-auth.spec.ts so multiple browser
 * specs can reuse it.
 */

import { expect, type Page } from '@playwright/test'
import { EMAIL_POLL_INTERVAL_MS, EMAIL_POLL_TIMEOUT_MS } from './constants.js'
import {
  extractMagicLinkUrl,
  extractOtpCode,
  extractOtpCodeFromMagicLinkUrl,
} from './otp-utils.js'
import { searchForNewEmail } from './temp-email.js'

// Demo app uses 6-digit OTP codes (configured in zerodev-signer-demo).
export const DEMO_APP_OTP_LENGTH = 6

async function expectDashboard(page: Page): Promise<void> {
  await page.waitForURL('**/dashboard', { timeout: 60_000 })
  await expect(page.getByText('Your Smart Wallet')).toBeVisible({
    timeout: 60_000,
  })
}

/** Completes plain-code OTP login through the UI, landing on the dashboard. */
export async function loginWithOtp(
  page: Page,
  email: string,
  authToken: string,
): Promise<void> {
  // Avoid a cold Next dev compile triggering Fast Refresh during the
  // post-login client redirect. Production builds already have this route.
  await page.request.get('/dashboard')
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
  if (extractOtpCodeFromMagicLinkUrl(emailContent)) {
    throw new Error('Plain-OTP project unexpectedly sent a magic-link email')
  }
  const otpCode = extractOtpCode(emailContent, DEMO_APP_OTP_LENGTH, true)
  if (!otpCode) throw new Error('OTP email did not contain a verification code')

  await page.getByLabel('Verification code').fill(otpCode)
  await page.getByRole('button', { name: /Confirm code/i }).click()

  await expectDashboard(page)
}

/** Completes magic-link login through the UI, landing on the dashboard. */
export async function loginWithMagicLink(
  page: Page,
  email: string,
  authToken: string,
): Promise<void> {
  await page.request.get('/dashboard')
  await page.addInitScript(() => {
    localStorage.setItem('zd:emailAuthMethod', 'magicLink')
  })
  await page.goto('/')
  await page.getByPlaceholder('Enter your email').fill(email)
  await page.getByPlaceholder('Enter your email').press('Enter')
  await expect(page.getByText(/check your email/i)).toBeVisible({
    timeout: 30_000,
  })

  const emailContent = await searchForNewEmail(
    authToken,
    EMAIL_POLL_INTERVAL_MS,
    EMAIL_POLL_TIMEOUT_MS,
  )
  const magicLinkUrl = extractMagicLinkUrl(emailContent)
  if (!magicLinkUrl) {
    throw new Error('Magic-link project sent no verification link')
  }

  // Navigate the actual emailed link rather than reconstructing /verify?code=
  // against baseURL, so a change to the project's magic_link_template (host or
  // path) is exercised here instead of silently passing. Assumes the template
  // points at the demo app under test.
  await page.goto(magicLinkUrl)
  await expectDashboard(page)
}
