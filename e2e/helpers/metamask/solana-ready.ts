/**
 * Waiting for MetaMask's Solana support to exist before anything connects.
 *
 * Solana arrives from a snap that initialises after the wallet UI is already
 * usable. Connect before it lands and the approval screen offers the EVM
 * account alone: the wallet grants it, the dapp gets no Solana account, and the
 * SDK throws "did not authorise a Solana account" 90s later, in whichever spec
 * happened to be running. On a GitHub-hosted runner it had not landed at all.
 *
 * The network picker is the cheapest place to see it — the account chip's chain
 * icons carry no accessible name, and clicking the address copies it rather
 * than listing the chains.
 */

import { expect, type Page } from '@playwright/test'

/** The snap is slow on a cold profile, slower on a CI runner. */
const SNAP_TIMEOUT_MS = 60_000

/** Gap between reopening the picker while waiting for the snap. */
const RETRY_MS = 2_000

/**
 * Fails unless the wallet lists Solana among its networks.
 *
 * `page` must be on the wallet's own UI and unlocked.
 */
export async function expectSolanaAccountReady(page: Page): Promise<void> {
  await expect(
    page.getByTestId('account-menu-icon'),
    'the MetaMask wallet UI never came up, so Solana support could not be checked',
  ).toBeVisible({ timeout: SNAP_TIMEOUT_MS })

  // Reopened on every attempt: the picker renders its list on open, so a dialog
  // left standing keeps showing whatever the snap had registered at that moment.
  const listsSolana = async (): Promise<boolean> => {
    await page
      .getByText(/^All networks$/i)
      .first()
      .click({ timeout: SNAP_TIMEOUT_MS })

    const shown = await page
      .getByText(/^Solana$/)
      .first()
      .isVisible()
      .catch(() => false)

    await page.keyboard.press('Escape')
    return shown
  }

  await expect
    .poll(listsSolana, {
      timeout: SNAP_TIMEOUT_MS,
      intervals: Array(30).fill(RETRY_MS),
      message:
        'MetaMask never loaded Solana, so a connect would be approved with the ' +
        'EVM account alone and the Solana side would come back empty',
    })
    .toBe(true)
}
