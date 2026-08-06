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
import { createNewAccount, ping } from '../helpers/temp-email.js'
import { loginWithMagicLink } from '../helpers/ui-login.js'

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
    await loginWithMagicLink(page, emailAccount.address, emailAccount.authToken)
    await expect(page.getByText('Your Smart Wallet')).toBeVisible()
    console.log('Magic link login successful')
  })
})
