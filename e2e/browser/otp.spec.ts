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
import { createNewAccount, ping } from '../helpers/temp-email.js'
import { loginWithOtp } from '../helpers/ui-login.js'

test.describe('OTP Flow', () => {
  test.beforeEach(async () => {
    try {
      await ping()
    } catch {
      test.skip(true, 'Email service unavailable')
    }
  })

  test('should complete OTP login through the UI', async ({ page }) => {
    const emailAccount = await createNewAccount()
    await loginWithOtp(page, emailAccount.address, emailAccount.authToken)
    await expect(page.getByText('Your Smart Wallet')).toBeVisible()
  })

  test('should verify OTP for an existing wallet after logout', async ({
    page,
  }) => {
    const emailAccount = await createNewAccount()
    await loginWithOtp(page, emailAccount.address, emailAccount.authToken)

    await page.getByRole('button', { name: /Logout/i }).click()
    await page.waitForURL('/', { timeout: 30_000 })

    await loginWithOtp(page, emailAccount.address, emailAccount.authToken)
    await expect(page.getByText('Your Smart Wallet')).toBeVisible()
  })
})
