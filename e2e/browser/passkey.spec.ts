/**
 * Browser E2E test for the Passkey (WebAuthn) authentication flow.
 *
 * Uses a CDP virtual authenticator to simulate biometric authentication.
 * This tests the FULL auth flow: WebAuthn ceremony → backend → Turnkey → session → lab.
 * The virtual authenticator auto-accepts the biometric prompt (the standard way
 * to test WebAuthn in Playwright/Puppeteer).
 *
 * After registration, tests wallet operations:
 * - Sign a plain-text message (signMessage)
 * - Sign EIP-712 typed data (signTypedDataV4)
 * - Mint an NFT via send transaction (signTransaction + sign7702Authorization)
 */

import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { expectLabReady } from '../helpers/ui-login.js'
import {
  getVirtualCredentials,
  setupVirtualAuthenticator,
  teardownVirtualAuthenticator,
  type VirtualAuthenticator,
} from '../helpers/virtual-authenticator.js'

/**
 * Register a passkey via virtual authenticator and wait for the lab to load.
 * Returns the virtual authenticator handle for teardown.
 */
async function registerAndEnterLab(page: Page): Promise<VirtualAuthenticator> {
  const virtualAuth = await setupVirtualAuthenticator(page)

  await page.goto('/')
  await expect(page.getByText('Continue to your wallet')).toBeVisible()

  await page.getByRole('button', { name: /Create a passkey/i }).click()

  await expectLabReady(page)

  return virtualAuth
}

test.describe('Passkey Flow', () => {
  let virtualAuth: VirtualAuthenticator

  test('registers a discoverable (resident) passkey', async ({ page }) => {
    // The regression guard for the login flow: login resolves credentials with
    // an empty allowCredentials list, so a passkey the SDK registers must be
    // resident/discoverable or it can never be used to log in. The virtual
    // authenticator honors the residentKey hint, so a non-resident credential
    // here would mean broken login.
    virtualAuth = await registerAndEnterLab(page)

    try {
      const credentials = await getVirtualCredentials(virtualAuth)
      expect(credentials.length).toBeGreaterThan(0)
      for (const cred of credentials) {
        expect(cred.isResidentCredential).toBe(true)
      }
      console.log('Passkey registered as a discoverable (resident) credential')
    } finally {
      await teardownVirtualAuthenticator(virtualAuth)
    }
  })

  test('should register with passkey and sign a message', async ({ page }) => {
    virtualAuth = await registerAndEnterLab(page)

    try {
      await page.getByTestId('nav-feature-tx-signing').click()
      await expect(page.getByTestId('area-signing')).toBeVisible()

      await page
        .getByTestId('case-sign-message-presets')
        .getByTestId('sign-message-submit')
        .click()

      const run = page.getByTestId('sign-run-1')
      await expect(run).toHaveAttribute('data-status', 'success', {
        timeout: 30_000,
      })
      await expect(run).toHaveAttribute('data-verify', 'valid', {
        timeout: 30_000,
      })
      console.log('Passkey registration + sign message successful')
    } finally {
      await teardownVirtualAuthenticator(virtualAuth)
    }
  })

  test('should sign typed data (EIP-712) after passkey registration', async ({
    page,
  }) => {
    virtualAuth = await registerAndEnterLab(page)

    try {
      await page.getByTestId('nav-feature-tx-signing').click()
      await expect(page.getByTestId('area-signing')).toBeVisible()

      await page.getByTestId('sign-typed-data-submit').click()

      await expect(page.getByTestId('typed-data-run-1')).toHaveAttribute(
        'data-status',
        'success',
        { timeout: 30_000 },
      )
      console.log('Typed data (EIP-712) signing successful')
    } finally {
      await teardownVirtualAuthenticator(virtualAuth)
    }
  })

  test('should mint NFT (send transaction) after passkey registration', async ({
    page,
  }) => {
    virtualAuth = await registerAndEnterLab(page)

    try {
      await page.getByTestId('nav-feature-tx-signing').click()
      await page.getByTestId('feature-tx-signing-tab-contracts').click()
      await expect(page.getByTestId('area-contracts')).toBeVisible()

      const mint = page.getByTestId('case-demo-nft-mint')
      await expect(mint.getByTestId('demo-nft-address')).not.toHaveText('—')
      await mint.getByTestId('demo-nft-mint-submit').click()

      await expect(mint.getByTestId('tx-run-1')).toHaveAttribute(
        'data-status',
        'success',
        { timeout: 60_000 },
      )
      console.log('Mint NFT (send transaction) successful')
    } finally {
      await teardownVirtualAuthenticator(virtualAuth)
    }
  })
})
