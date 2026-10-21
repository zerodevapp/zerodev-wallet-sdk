/**
 * Browser E2E test for the Magic Link authentication flow.
 *
 * Drives the QA lab UI end to end: request a magic link against the
 * magic-link-configured project, then navigate the link as it was actually
 * emailed — so a change to the project's `magic_link_template` fails here
 * rather than passing silently.
 */

import { test } from '@playwright/test'
import { createNewAccount } from '../helpers/temp-email.js'
import { loginWithMagicLink } from '../helpers/ui-login.js'

test.describe('Magic Link Flow', () => {
  test('should complete magic link login through the UI', async ({ page }) => {
    const emailAccount = await createNewAccount()
    await loginWithMagicLink(page, emailAccount.address, emailAccount.authToken)
  })
})
