/**
 * Browser E2E test for the Passkey (WebAuthn) authentication flow.
 *
 * Uses a CDP virtual authenticator to simulate biometric authentication.
 * This tests the FULL auth flow: WebAuthn ceremony → backend → Turnkey → session → dashboard.
 * The virtual authenticator auto-accepts the biometric prompt (the standard way
 * to test WebAuthn in Playwright/Puppeteer).
 */

import { expect, test } from '@playwright/test'
import {
  setupVirtualAuthenticator,
  teardownVirtualAuthenticator,
  type VirtualAuthenticator,
} from '../helpers/virtual-authenticator.js'

test.describe('Passkey Flow', () => {
  let virtualAuth: VirtualAuthenticator

  test('should register with passkey and access wallet dashboard', async ({
    page,
  }) => {
    virtualAuth = await setupVirtualAuthenticator(page)

    try {
      // Navigate to login page
      await page.goto('/')
      await expect(
        page.getByRole('heading', { name: 'ZeroDev Wallet Demo' }),
      ).toBeVisible()

      // Click "Register with passkey" — triggers WebAuthn create ceremony
      await page.getByRole('button', { name: /Register with passkey/i }).click()

      // Wait for redirect to dashboard (includes backend + Turnkey round-trips)
      await page.waitForURL('**/dashboard', { timeout: 60_000 })

      // Verify wallet loaded with real data
      await expect(page.getByText('Default Wallet')).toBeVisible({
        timeout: 60_000,
      })

      // Verify wallet address is displayed (0x... format)
      await expect(page.getByText(/0x[0-9a-fA-F]{40}/)).toBeVisible()

      // Verify chain info is shown
      await expect(page.getByText('Arbitrum Sepolia Testnet')).toBeVisible()

      // Sign a message to prove the wallet is fully functional
      await page
        .getByRole('navigation')
        .getByRole('button', { name: /Sign Message/i })
        .click()
      await page.getByRole('button', { name: /Load Sample/i }).click()
      await page
        .getByRole('button', { name: /Sign Message/i })
        .nth(1)
        .click()
      await expect(page.getByText('Signature')).toBeVisible({ timeout: 30_000 })

      console.log('Passkey registration + sign message successful')
    } finally {
      await teardownVirtualAuthenticator(virtualAuth)
    }
  })
})
