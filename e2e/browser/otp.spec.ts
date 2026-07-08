/**
 * Browser E2E test for the OTP authentication flow.
 *
 * Tests the full OTP flow through the demo app UI:
 * 1. Create temp email (or use mock)
 * 2. Navigate to login page
 * 3. Enter email and click "Continue with email OTP code"
 * 4. Wait for OTP verification step
 * 5. Resolve OTP code (mock: fixture constant; real: poll inbox)
 * 6. Enter OTP code and click "Verify and continue"
 * 7. Verify redirect to /dashboard
 * 8. Verify wallet address and balance are displayed
 *
 * The `otpSession` fixture handles USE_REAL_EMAIL branching; no if/else here.
 */

import { expect, test } from '../fixtures/auth.js'
import {
  EMAIL_POLL_INTERVAL_MS,
  EMAIL_POLL_TIMEOUT_MS,
} from '../helpers/constants.js'
import { extractOtpCode } from '../helpers/otp-utils.js'
import { searchForNewEmail } from '../helpers/temp-email.js'

// Demo app uses 6-digit OTP codes (configured in zerodev-signer-demo)
const DEMO_APP_OTP_LENGTH = 6

test.describe('OTP Flow', () => {
  test('should complete OTP login through the UI', async ({
    page,
    otpSession,
  }) => {
    const email = otpSession.email

    // Step 2: Seed the demo's email-method choice so wagmi-config picks OTP
    // on first paint. Then navigate.
    await page.addInitScript(() => {
      localStorage.setItem('zd:emailAuthMethod', 'otp')
    })
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

    // Step 6: Resolve OTP code — use fixture value in mock mode, poll inbox in real mode
    const otpCode =
      otpSession.otpCode ??
      extractOtpCode(
        await searchForNewEmail(
          otpSession.authToken!,
          EMAIL_POLL_INTERVAL_MS,
          EMAIL_POLL_TIMEOUT_MS,
        ),
        DEMO_APP_OTP_LENGTH,
        true,
      )
    expect(otpCode).toBeTruthy()

    // Step 7: Enter OTP code
    // CodeInput uses a hidden input (opacity:0) with autoFocus. Type via keyboard
    // so React's synthetic onChange fires correctly on each character.
    await page.keyboard.type(otpCode!)

    // Step 8: Click verify
    await page.getByRole('button', { name: /Confirm code/i }).click()

    // Step 9: Wait for dashboard redirect
    await page.waitForURL('**/dashboard', { timeout: 60_000 })

    // Step 10: Verify dashboard elements (wallet creation can take time)
    await expect(page.getByText('Your Smart Wallet')).toBeVisible({
      timeout: 60_000,
    })
  })
})
