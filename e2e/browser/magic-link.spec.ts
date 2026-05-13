/**
 * Browser E2E test for the Magic Link authentication flow.
 *
 * Tests the magic link flow through the demo app UI:
 * 1. Create temp email
 * 2. Navigate to login page
 * 3. Enter email and click "Continue with email magic link"
 * 4. Wait for "Magic link sent" confirmation
 * 5. Poll for email, extract OTP code from the magic link URL
 * 6. Navigate to the magic link URL (simulating email click)
 * 7. Verify auto-verification succeeds and redirects to /dashboard
 */

import { expect, test } from '@playwright/test'
import {
  EMAIL_POLL_INTERVAL_MS,
  EMAIL_POLL_TIMEOUT_MS,
} from '../helpers/constants.js'
import { extractOtpCodeFromMagicLinkUrl } from '../helpers/otp-utils.js'
import {
  createNewAccount,
  ping,
  searchForNewEmail,
} from '../helpers/temp-email.js'

test.describe('Magic Link Flow', () => {
  test.beforeEach(async () => {
    try {
      await ping()
    } catch {
      test.skip(true, 'Email service unavailable')
    }
  })

  test('should complete magic link login through the UI', async ({ page }) => {
    // Step 1: Create temp email
    const emailAccount = await createNewAccount()
    const email = emailAccount.address

    // Step 2: Navigate to login page (debug flag renders separate
    // magic-link + OTP buttons regardless of demo's emailAuthMethod config)
    await page.goto('/?renderBothEmailButtons=true')
    await expect(page.getByText('Continue to your wallet')).toBeVisible()

    // Step 3: Enter email
    await page.getByPlaceholder('Enter your email').fill(email)

    // Step 4: Click magic link button
    await page
      .getByRole('button', { name: /Continue with email magic link/i })
      .click()

    // Step 5: Wait for confirmation that magic link was sent
    await expect(page.getByText(/magic link sent/i)).toBeVisible({
      timeout: 30_000,
    })

    // Step 6: Poll for email and extract OTP code from the magic link URL
    const emailContent = await searchForNewEmail(
      emailAccount.authToken,
      EMAIL_POLL_INTERVAL_MS,
      EMAIL_POLL_TIMEOUT_MS,
    )
    const otpCode = extractOtpCodeFromMagicLinkUrl(emailContent)
    expect(otpCode).toBeTruthy()
    console.log(`Extracted magic link code: ${otpCode}`)

    // Step 7: Navigate to the verify URL (simulating clicking the magic link)
    // The demo app stores otpId in localStorage, so we navigate in the same context
    await page.goto(`/verify?code=${otpCode}`)

    // Step 8: Wait for auto-verification and redirect to dashboard
    await expect(page.getByText(/Authentication Successful/i)).toBeVisible({
      timeout: 30_000,
    })
    await page.waitForURL('**/dashboard', { timeout: 60_000 })

    // Step 9: Verify dashboard loaded
    // Wallet creation (EIP-7702 Kernel) can be slow, so accept either
    // the loaded state or the loading spinner as proof of successful auth
    await expect(
      page.getByText('Default Wallet').or(page.getByText('Loading wallet')),
    ).toBeVisible({ timeout: 60_000 })
    console.log('Magic link login successful')
  })
})
