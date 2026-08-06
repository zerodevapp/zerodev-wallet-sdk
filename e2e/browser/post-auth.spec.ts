/**
 * Browser E2E test for post-authentication operations.
 *
 * After OTP login, drives the QA lab's Tx Signing surface:
 * 1. Sign a plain message (Signing area)
 * 2. Sign EIP-712 typed data (Signing area)
 * 3. Mint an NFT via a contract write (Contracts area)
 * 4. Logout and verify the login surface returns
 */

import { expect, test } from '@playwright/test'
import { createNewAccount, ping } from '../helpers/temp-email.js'
import { loginWithOtp } from '../helpers/ui-login.js'

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

    // Client-side navigation via the sidebar — a full page load would drop the
    // wallet into a reconnect, which isn't what this test is about.
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
    // The lab verifies the returned signature against this account for the
    // exact message it sent, so this asserts the signature is real rather than
    // merely that the call resolved.
    await expect(run).toHaveAttribute('data-verify', 'valid', {
      timeout: 30_000,
    })
  })

  test('should sign typed data (EIP-712) after login', async ({ page }) => {
    const emailAccount = await createNewAccount()
    await loginWithOtp(page, emailAccount.address, emailAccount.authToken)

    await page.getByTestId('nav-feature-tx-signing').click()
    await expect(page.getByTestId('area-signing')).toBeVisible()

    // Payload is pre-filled and valid for the connected chain.
    await page.getByTestId('sign-typed-data-submit').click()

    await expect(page.getByTestId('typed-data-run-1')).toHaveAttribute(
      'data-status',
      'success',
      { timeout: 30_000 },
    )
  })

  test('should mint NFT (send transaction) after login', async ({ page }) => {
    const emailAccount = await createNewAccount()
    await loginWithOtp(page, emailAccount.address, emailAccount.authToken)

    await page.getByTestId('nav-feature-tx-signing').click()
    await page.getByTestId('feature-tx-signing-tab-contracts').click()
    await expect(page.getByTestId('area-contracts')).toBeVisible()

    // Mints the signer demo's NFT, the same contract this test targeted before
    // the suite moved to the lab. Mints to the connected wallet, so there are
    // no arguments to set.
    const mint = page.getByTestId('case-demo-nft-mint')
    await expect(mint.getByTestId('demo-nft-address')).not.toHaveText('—')
    await mint.getByTestId('demo-nft-mint-submit').click()

    const run = mint.getByTestId('tx-run-1')
    await expect(run).toHaveAttribute('data-status', 'success', {
      timeout: 60_000,
    })
    await expect(run.getByTestId('tx-run-hash')).toHaveAttribute(
      'data-hash',
      /^0x[0-9a-fA-F]{64}$/,
    )
  })

  test('should logout and return to the login surface', async ({ page }) => {
    const emailAccount = await createNewAccount()
    await loginWithOtp(page, emailAccount.address, emailAccount.authToken)

    await page.getByTestId('wallet-logout').click()

    // The lab has no logout redirect — the gate swaps the lab back out for the
    // login surface at whatever route you were on.
    await expect(page.getByTestId('wallet-strip')).toBeHidden({
      timeout: 30_000,
    })
    await expect(page.getByText('Sign in to open the QA Lab')).toBeVisible({
      timeout: 30_000,
    })
  })
})
