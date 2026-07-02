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

    // Step 2: Seed the demo's email-method choice so wagmi-config picks
    // magic-link on first paint. Then navigate.
    await page.addInitScript(() => {
      localStorage.setItem('zd:emailAuthMethod', 'magicLink')
    })
    await page.goto('/')
    await expect(page.getByText('Continue to your wallet')).toBeVisible()

    // Step 3: Enter email and submit (press Enter)
    await page.getByPlaceholder('Enter your email').fill(email)
    await page.getByPlaceholder('Enter your email').press('Enter')

    // Step 5: Wait for confirmation that magic link was sent
    // (kit's EmailVerification screen renders "Check your email!")
    await expect(page.getByText(/check your email/i)).toBeVisible({
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

    // Step 8: Wait for auto-verification and redirect to dashboard.
    // The kit has no dedicated success screen — `goToStep('authenticated')`
    // transitions silently and the demo's effect routes to /dashboard.
    await page.waitForURL('**/dashboard', { timeout: 60_000 })

    // Step 9: Verify dashboard loaded
    // Wallet creation (EIP-7702 Kernel) can be slow, so accept either
    // the loaded state or the loading spinner as proof of successful auth
    await expect(
      page.getByText('Your Smart Wallet').or(page.getByText('Loading wallet')),
    ).toBeVisible({ timeout: 60_000 })
    console.log('Magic link login successful')
  })
})
