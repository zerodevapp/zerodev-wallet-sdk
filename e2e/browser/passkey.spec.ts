/**
 * Browser E2E test for the Passkey (WebAuthn) authentication flow.
 *
 * Uses a CDP virtual authenticator to simulate biometric authentication.
 * This tests the FULL auth flow: WebAuthn ceremony → backend → Turnkey → session → dashboard.
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
import {
  setupVirtualAuthenticator,
  teardownVirtualAuthenticator,
  type VirtualAuthenticator,
} from '../helpers/virtual-authenticator.js'

/**
 * Sample EIP-712 typed data using Arbitrum Sepolia chainId (421614).
 * Must match a chain allowed by the project, otherwise the backend rejects it.
 */
const TYPED_DATA_SAMPLE = JSON.stringify(
  {
    domain: {
      name: 'Ether Mail',
      version: '1',
      chainId: 421614,
      verifyingContract: '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC',
    },
    types: {
      Person: [
        { name: 'name', type: 'string' },
        { name: 'wallet', type: 'address' },
      ],
      Mail: [
        { name: 'from', type: 'Person' },
        { name: 'to', type: 'Person' },
        { name: 'contents', type: 'string' },
      ],
    },
    primaryType: 'Mail',
    message: {
      from: {
        name: 'Cow',
        wallet: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826',
      },
      to: {
        name: 'Bob',
        wallet: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
      },
      contents: 'Hello, Bob!',
    },
  },
  null,
  2,
)

/**
 * Register a passkey via virtual authenticator and wait for the dashboard to load.
 * Returns the virtual authenticator handle for teardown.
 */
async function registerAndWaitForDashboard(
  page: Page,
): Promise<VirtualAuthenticator> {
  const virtualAuth = await setupVirtualAuthenticator(page)

  await page.goto('/')
  await expect(page.getByText('Continue to your wallet')).toBeVisible()

  await page.getByRole('button', { name: /Create a passkey/i }).click()

  await page.waitForURL('**/dashboard', { timeout: 60_000 })
  await expect(page.getByText('Default Wallet')).toBeVisible({
    timeout: 60_000,
  })
  await expect(page.getByText(/0x[0-9a-fA-F]{40}/)).toBeVisible()

  return virtualAuth
}

test.describe('Passkey Flow', () => {
  let virtualAuth: VirtualAuthenticator

  test('should register with passkey and sign a message', async ({ page }) => {
    virtualAuth = await registerAndWaitForDashboard(page)

    try {
      // Navigate to Sign Message tab
      await page
        .getByRole('navigation')
        .getByRole('button', { name: /Sign Message/i })
        .click()

      // Load sample message and sign
      await page.getByRole('button', { name: /Load Sample/i }).click()
      await page
        .getByRole('button', { name: /Sign Message/i })
        .nth(1)
        .click()

      // Exact match avoids the kit's "Signature Request" heading; match only
      // the result-panel label.
      await expect(page.getByText('Signature', { exact: true })).toBeVisible({
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
    virtualAuth = await registerAndWaitForDashboard(page)

    try {
      // Navigate to Sign Message tab
      await page
        .getByRole('navigation')
        .getByRole('button', { name: /Sign Message/i })
        .click()

      // Switch to Typed Data mode
      await page
        .getByRole('button', { name: /Typed Data \(EIP-712\)/i })
        .click()

      // Fill with typed data using a valid chainId for the project
      const textarea = page.getByPlaceholder('Enter EIP-712 typed data JSON...')
      await textarea.fill(TYPED_DATA_SAMPLE)

      // Click the "Sign Typed Data" action button
      await page.getByRole('button', { name: /Sign Typed Data/i }).click()

      await expect(page.getByText('Signature', { exact: true })).toBeVisible({
        timeout: 30_000,
      })
      console.log('Typed data (EIP-712) signing successful')
    } finally {
      await teardownVirtualAuthenticator(virtualAuth)
    }
  })

  test('should mint NFT (send transaction) after passkey registration', async ({
    page,
  }) => {
    virtualAuth = await registerAndWaitForDashboard(page)

    try {
      // Default tab is "Send Transaction" with "Mint NFT" mode selected.
      // Navigate to Send Transaction tab explicitly to be safe.
      await page
        .getByRole('navigation')
        .getByRole('button', { name: /Send Transaction/i })
        .click()

      // Click the "Mint NFT" action button (second match — first is the mode selector)
      await page
        .getByRole('button', { name: /Mint NFT/i })
        .nth(1)
        .click()

      await expect(page.getByText('NFT minted successfully!')).toBeVisible({
        timeout: 60_000,
      })
      console.log('Mint NFT (send transaction) successful')
    } finally {
      await teardownVirtualAuthenticator(virtualAuth)
    }
  })
})
