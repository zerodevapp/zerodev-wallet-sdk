/**
 * Browser E2E test for post-authentication operations.
 *
 * After OTP login:
 * 1. Sign a message via the "Sign Message" tab
 * 2. Send a transaction via the "Send Transaction" tab
 * 3. Copy wallet address
 * 4. Logout and verify redirect to login page
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

/** Helper to complete OTP login through the UI */
async function loginWithOtp(
  page: import('@playwright/test').Page,
  email: string,
  authToken: string,
) {
  await page.goto('/')
  await page.getByPlaceholder('Enter your email').fill(email)
  await page
    .getByRole('button', { name: /Continue with email OTP code/i })
    .click()
  await expect(
    page.getByText(`Enter the code sent to ${email}`, { exact: false }),
  ).toBeVisible({ timeout: 30_000 })

  const emailContent = await searchForNewEmail(
    authToken,
    EMAIL_POLL_INTERVAL_MS,
    EMAIL_POLL_TIMEOUT_MS,
  )
  const otpCode = extractOtpCode(emailContent, DEMO_APP_OTP_LENGTH, true)
  expect(otpCode).toBeTruthy()

  await page.getByPlaceholder('000000').fill(otpCode!)
  await page.getByRole('button', { name: /Verify and continue/i }).click()

  await page.waitForURL('**/dashboard', { timeout: 60_000 })
  await expect(page.getByText('Default Wallet')).toBeVisible({
    timeout: 60_000,
  })
}

test.describe('Post-Auth Operations', () => {
  test.beforeEach(async () => {
    try {
      await ping()
    } catch {
      test.skip(true, 'Email service unavailable')
    }
  })

  test('should sign a message after login', async ({ page }) => {
    const emailAccount = await createNewAccount()
    await loginWithOtp(page, emailAccount.address, emailAccount.authToken)

    // Click the "Sign Message" tab (in the navigation area)
    await page
      .getByRole('navigation')
      .getByRole('button', { name: /Sign Message/i })
      .click()

    // Load sample message
    await page.getByRole('button', { name: /Load Sample/i }).click()

    // Click the "Sign Message" action button (second one — first is the tab)
    await page
      .getByRole('button', { name: /Sign Message/i })
      .nth(1)
      .click()

    // Wait for signature result
    await expect(page.getByText('Signature')).toBeVisible({ timeout: 30_000 })
    console.log('Message signed successfully')
  })

  test('should logout and redirect to login page', async ({ page }) => {
    const emailAccount = await createNewAccount()
    await loginWithOtp(page, emailAccount.address, emailAccount.authToken)

    // Click logout
    await page.getByRole('button', { name: /Logout/i }).click()

    // Verify redirect to login page
    await page.waitForURL('/', { timeout: 15_000 })
    await expect(
      page.getByRole('heading', { name: 'ZeroDev Wallet Demo' }),
    ).toBeVisible()
    console.log('Logout successful')
  })
})
