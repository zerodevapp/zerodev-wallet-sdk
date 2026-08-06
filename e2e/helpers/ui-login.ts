/**
 * Shared Playwright helpers for getting into the QA lab through its UI.
 * Extracted from post-auth.spec.ts so multiple browser specs can reuse them.
 */

import { expect, type Page } from '@playwright/test'
import {
  EMAIL_POLL_INTERVAL_MS,
  EMAIL_POLL_TIMEOUT_MS,
  OTP_CODE_LENGTH,
} from './constants.js'
import { extractOtpCode } from './otp-utils.js'
import { searchForNewEmail } from './temp-email.js'

/**
 * Waits for the authenticated lab. The lab has no post-login route — its auth
 * gate swaps the login surface for the lab at the same URL once wagmi reports
 * connected, so there is no navigation to wait on.
 */
export async function expectLabReady(page: Page): Promise<void> {
  await expect(page.getByTestId('wallet-strip')).toBeVisible({
    timeout: 60_000,
  })
  await expect(page.getByTestId('wallet-address')).toHaveText(
    /^0x[0-9a-fA-F]{40}$/,
    { timeout: 60_000 },
  )
}

/** Completes OTP login through the UI, landing on the authenticated lab. */
export async function loginWithOtp(
  page: Page,
  email: string,
  authToken: string,
): Promise<void> {
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
  const otpCode = extractOtpCode(emailContent, OTP_CODE_LENGTH, true)
  expect(otpCode).toBeTruthy()

  await page.getByLabel('Verification code').fill(otpCode!)
  await page.getByRole('button', { name: /Confirm code/i }).click()

  await expectLabReady(page)
}
