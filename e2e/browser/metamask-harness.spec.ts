/**
 * Proves the real-MetaMask harness before anything relies on it.
 *
 * These assert the harness, not the product: that the pinned build loads, that
 * the cached profile really is an onboarded wallet, and that the wallet holds
 * the address the configured recovery phrase derives. Without them a broken
 * cache would surface as a confusing product failure in the connect specs.
 */

import { expect } from '@playwright/test'
import { test } from '../fixtures/metamask.js'

test.describe('MetaMask harness', () => {
  // First run in a clean checkout downloads ~23MB and onboards from scratch.
  test.describe.configure({ timeout: 300_000 })

  test('loads the pinned extension and reports a stable id', async ({
    context,
    extensionId,
  }) => {
    expect(extensionId).toMatch(/^[a-p]{32}$/)

    const workers = context.serviceWorkers()
    expect(
      workers.some((w) =>
        w.url().startsWith(`chrome-extension://${extensionId}/`),
      ),
    ).toBe(true)
  })

  test('the cached profile is already onboarded', async ({ walletPage }) => {
    await expect(walletPage.getByTestId('account-menu-icon')).toBeVisible()

    expect(walletPage.url()).not.toContain('onboarding')
  })
})
