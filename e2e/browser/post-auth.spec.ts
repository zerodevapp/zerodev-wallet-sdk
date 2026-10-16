/**
 * Browser E2E test for post-authentication operations.
 *
 * After magic-link login, drives the QA lab's Tx Signing surface:
 * 1. Sign a plain message (Signing area)
 * 2. Sign EIP-712 typed data (Signing area)
 * 3. Mint an NFT via a contract write (Contracts area)
 *
 * Logout lives in otp.spec.ts, which covers the same surface plus re-login.
 */

import { expect, type Page } from '@playwright/test'
import { test } from '../fixtures/authed-session.js'
import { createNewAccount, ping } from '../helpers/temp-email.js'
import {
  expectSignRunSucceeded,
  expectTxRunSucceeded,
} from '../helpers/tx-runs.js'
import { expectLabReady, loginWithMagicLink } from '../helpers/ui-login.js'

/**
 * Signs the preset message from the lab's Signing area and asserts the run
 * succeeded and verified.
 *
 * Assumes a freshly-loaded page: run ids restart at 1 with the component, so
 * calling this twice without a reload in between would look for the wrong run.
 */
async function signMessage(page: Page) {
  // Client-side navigation via the sidebar — a full page load would drop the
  // wallet into a reconnect, which isn't what these tests are about.
  await page.getByTestId('nav-feature-tx-signing').click()
  await expect(page.getByTestId('area-signing')).toBeVisible()

  await page
    .getByTestId('case-sign-message-presets')
    .getByTestId('sign-message-submit')
    .click()

  await expectSignRunSucceeded(page.getByTestId('sign-run-1'))
}

test.describe('Post-Auth Operations', () => {
  test.beforeEach(async () => {
    try {
      await ping()
    } catch {
      test.skip(true, 'Email service unavailable')
    }
  })

  test('should sign a message after login', async ({ authedPage: page }) => {
    await signMessage(page)
  })

  // Fresh login on purpose: this rewrites session expiry and rotates the
  // session id, which would break every test reusing the shared one.
  test('should auto-refresh, sign, reload, and sign again', async ({
    page,
  }) => {
    test.setTimeout(180_000)
    const emailAccount = await createNewAccount()
    await loginWithMagicLink(page, emailAccount.address, emailAccount.authToken)

    const initialSessionId = await page.evaluate(() =>
      localStorage.getItem('@zerodev/active_session'),
    )
    if (!initialSessionId) throw new Error('Expected an active browser session')

    await page.evaluate((sessionId) => {
      const stored = localStorage.getItem(sessionId)
      if (!stored) throw new Error('Expected the active session record')
      const session = JSON.parse(stored)
      // Expiry 65s out: just past SESSION_WARNING_THRESHOLD_MS (60s in
      // provider.ts), so on reload the refresh fires on the scheduled timer
      // (~5s later) — the path under test — while still landing inside the 30s
      // waitForResponse below. If that threshold moves, this could silently
      // cover the immediate-refresh path (raise it well past 65s) or time out
      // (lower it below the wait window) instead. Keep them in sync.
      session.expiry = Date.now() + 65_000
      localStorage.setItem(sessionId, JSON.stringify(session))
    }, initialSessionId)

    const refreshResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        response.url().endsWith('/auth/login/stamp'),
      { timeout: 30_000 },
    )
    await page.reload()
    await expectLabReady(page)

    const refreshResponse = await refreshResponsePromise
    expect(refreshResponse.ok()).toBe(true)
    await refreshResponse.finished()

    await expect
      .poll(
        () =>
          page.evaluate(() => localStorage.getItem('@zerodev/active_session')),
        { timeout: 30_000 },
      )
      .not.toBe(initialSessionId)

    await signMessage(page)
    await page.reload()
    await expectLabReady(page)
    await signMessage(page)
  })

  test('should sign typed data (EIP-712) after login', async ({
    authedPage: page,
  }) => {
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

  test('should mint NFT (send transaction) after login', async ({
    authedPage: page,
  }) => {
    await page.getByTestId('nav-feature-tx-signing').click()
    await page.getByTestId('feature-tx-signing-tab-contracts').click()
    await expect(page.getByTestId('area-contracts')).toBeVisible()

    // Mints the signer demo's NFT, the same contract this test targeted before
    // the suite moved to the lab. Mints to the connected wallet, so there are
    // no arguments to set.
    const mint = page.getByTestId('case-demo-nft-mint')
    await expect(mint.getByTestId('demo-nft-address')).not.toHaveText('—')
    await mint.getByTestId('demo-nft-mint-submit').click()

    await expectTxRunSucceeded(mint.getByTestId('tx-run-1'))
  })
})
