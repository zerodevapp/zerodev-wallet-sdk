/**
 * Browser E2E test for wallet export.
 *
 * After OTP login, opens the Export Keys modal and verifies the real decrypted
 * secret is rendered inside the Turnkey export iframe:
 *   1. Seed phrase -> 12/24-word BIP-39 mnemonic
 *   2. Private key -> hex
 *
 * NOTE: the secret renders inside Turnkey's cross-origin iframe
 * (https://export.turnkey.com), whose DOM we do not control. Reading it couples
 * this test to Turnkey's markup — a Turnkey UI change can break these
 * assertions independent of the ZeroDev SDK. This depth is intentional: we want
 * proof the SRP / private key are actually shown, not just that the flow ran.
 */

import { expect, type FrameLocator, type Page, test } from '@playwright/test'
import { createNewAccount, ping } from '../helpers/temp-email.js'
import { loginWithOtp } from '../helpers/ui-login.js'

/**
 * Reads rendered text out of a Turnkey export iframe. Waits until the iframe
 * body has non-whitespace text, then returns it trimmed.
 */
async function readIframeSecretText(frame: FrameLocator): Promise<string> {
  const body = frame.locator('body')
  await expect
    .poll(async () => (await body.innerText()).trim().length, {
      timeout: 30_000,
    })
    .toBeGreaterThan(0)
  return (await body.innerText()).trim()
}

/** Opens the Export Keys modal and confirms the security warning is shown. */
async function openExportModal(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Export keys/i }).click()
  await expect(page.getByText('Security Warning')).toBeVisible()
}

test.describe('Wallet Export', () => {
  test.beforeEach(async () => {
    try {
      await ping()
    } catch {
      test.skip(true, 'Email service unavailable')
    }
  })

  test('should export the seed phrase', async ({ page }) => {
    const emailAccount = await createNewAccount()
    await loginWithOtp(page, emailAccount.address, emailAccount.authToken)

    await openExportModal(page)
    await page.getByRole('button', { name: /Seed Phrase/i }).click()

    // App-level success (hard).
    await expect(page.getByText('Your Seed Phrase')).toBeVisible({
      timeout: 30_000,
    })
    await expect(
      page.locator('#export-wallet-iframe-container iframe'),
    ).toBeAttached({ timeout: 60_000 })
    await expect(page.getByText('Export Failed')).toHaveCount(0)
    await expect(page.getByText('Loading secure export...')).toBeHidden({
      timeout: 60_000,
    })

    // Secret presence in the iframe (hard).
    const frame = page.frameLocator('iframe#export-wallet-iframe')
    const secret = await readIframeSecretText(frame)
    const words = secret.split(/\s+/).filter(Boolean)
    expect([12, 24]).toContain(words.length)
    for (const word of words) {
      expect(word).toMatch(/^[a-z]+$/)
    }
    console.log(`Seed phrase export OK: ${words.length} words`)
  })

  test('should export the private key', async ({ page }) => {
    const emailAccount = await createNewAccount()
    await loginWithOtp(page, emailAccount.address, emailAccount.authToken)

    await openExportModal(page)
    await page.getByRole('button', { name: /Private Key/i }).click()

    // App-level success (hard).
    await expect(page.getByText('Your Private Key')).toBeVisible({
      timeout: 30_000,
    })
    await expect(
      page.locator('#export-wallet-iframe-container iframe'),
    ).toBeAttached({ timeout: 60_000 })
    await expect(page.getByText('Export Failed')).toHaveCount(0)
    await expect(page.getByText('Loading secure export...')).toBeHidden({
      timeout: 60_000,
    })

    // Secret presence in the iframe (hard).
    const frame = page.frameLocator('iframe#export-private-key-iframe')
    const secret = await readIframeSecretText(frame)
    expect(secret.trim()).toMatch(/^(?:0x)?[0-9a-f]{64}$/i)
    console.log('Private key export OK')
  })
})
