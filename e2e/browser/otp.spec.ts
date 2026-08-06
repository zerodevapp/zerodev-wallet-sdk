/**
 * Browser E2E test for the OTP authentication flow.
 *
 * Tests the full OTP flow through the QA lab UI:
 * 1. Create temp email
 * 2. Navigate to login page
 * 3. Enter email and click "Continue with email OTP code"
 * 4. Wait for OTP verification step
 * 5. Poll for email, extract OTP code
 * 6. Enter OTP code and click "Verify and continue"
 * 7. Verify the lab renders authenticated, with the wallet address
 */

import { expect, test } from '@playwright/test'
import {
  EMAIL_POLL_INTERVAL_MS,
  EMAIL_POLL_TIMEOUT_MS,
  OTP_CODE_LENGTH,
} from '../helpers/constants.js'
import { extractOtpCode } from '../helpers/otp-utils.js'
import {
  createNewAccount,
  ping,
  searchForNewEmail,
} from '../helpers/temp-email.js'
import { expectLabReady } from '../helpers/ui-login.js'

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

    // Step 2: Navigate. The lab defaults to OTP as its email method.
    await page.goto('/')
    await expect(page.getByText('Continue to your wallet')).toBeVisible()

    // Step 3: Enter email and submit (press Enter)
    await page.getByPlaceholder('Enter your email').fill(email)
    await page.getByPlaceholder('Enter your email').press('Enter')

    // Step 5: Wait for OTP verification step
    await expect(
      page.getByText(`Enter the code from the email we sent to ${email}`, {
        exact: false,
      }),
    ).toBeVisible({ timeout: 30_000 })

    // Step 6: Poll for email and extract OTP code
    const emailContent = await searchForNewEmail(
      emailAccount.authToken,
      EMAIL_POLL_INTERVAL_MS,
      EMAIL_POLL_TIMEOUT_MS,
    )
    const otpCode = extractOtpCode(emailContent, OTP_CODE_LENGTH, true)
    expect(otpCode).toBeTruthy()

    // Step 7: Enter OTP code
    await page.getByLabel('Verification code').fill(otpCode!)

    // Step 8: Click verify
    await page.getByRole('button', { name: /Confirm code/i }).click()

    // Step 9: The lab replaces the login surface in place (wallet creation can
    // take time)
    await expectLabReady(page)
  })
})
