/**
 * Browser E2E test for the OTP authentication flow.
 *
 * Tests the full OTP flow through the demo app UI:
 * 1. Create temp email
 * 2. Navigate to login page
 * 3. Enter email and click "Continue with email OTP code"
 * 4. Wait for OTP verification step
 * 5. Poll for email, extract OTP code
 * 6. Enter OTP code and click "Verify and continue"
 * 7. Verify redirect to /dashboard
 * 8. Verify wallet address and balance are displayed
 */

import { expect, test } from '@playwright/test'
import {
  EMAIL_POLL_INTERVAL_MS,
  EMAIL_POLL_TIMEOUT_MS,
} from '../helpers/constants.js'

// Demo app uses 6-digit OTP codes (configured in zerodev-signer-demo)
const DEMO_APP_OTP_LENGTH = 6

import { extractOtpCode } from '../helpers/otp-utils.js'
import {
  createNewAccount,
  ping,
  searchForNewEmail,
} from '../helpers/temp-email.js'

test.describe('OTP Flow', () => {
  test.beforeEach(async () => {
    try {
      await ping()
    } catch {
      test.skip(true, 'Email service unavailable')
    }
  })

  test('should complete OTP login through the UI', async ({ page }) => {
    // Step 1: Create temp email
    const emailAccount = await createNewAccount()
    const email = emailAccount.address

    // Step 2: Navigate to login page (debug flag renders separate
    // magic-link + OTP buttons regardless of demo's emailAuthMethod config)
    await page.goto('/?renderBothEmailButtons=true')
    await expect(page.getByText('Continue to your wallet')).toBeVisible()

    // Step 3: Enter email
    await page.getByPlaceholder('Enter your email').fill(email)

    // Step 4: Click OTP button
    await page
      .getByRole('button', { name: /Continue with email OTP code/i })
      .click()

    // Step 5: Wait for OTP verification step
    await expect(
      page.getByText(`Enter the code sent to ${email}`, { exact: false }),
    ).toBeVisible({ timeout: 30_000 })

    // Step 6: Poll for email and extract OTP code
    const emailContent = await searchForNewEmail(
      emailAccount.authToken,
      EMAIL_POLL_INTERVAL_MS,
      EMAIL_POLL_TIMEOUT_MS,
    )
    const otpCode = extractOtpCode(emailContent, DEMO_APP_OTP_LENGTH, true)
    expect(otpCode).toBeTruthy()

    // Step 7: Enter OTP code
    await page.getByPlaceholder('000000').fill(otpCode!)

    // Step 8: Click verify
    await page.getByRole('button', { name: /Verify and continue/i }).click()

    // Step 9: Wait for dashboard redirect
    await page.waitForURL('**/dashboard', { timeout: 60_000 })

    // Step 10: Verify dashboard elements (wallet creation can take time)
    await expect(page.getByText('Default Wallet')).toBeVisible({
      timeout: 60_000,
    })
  })
})
