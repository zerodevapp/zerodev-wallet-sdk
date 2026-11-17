/**
 * Browser E2E for connecting the lab to a real Zerion extension.
 *
 * Needs the lab running. The first run downloads the pinned Zerion build and
 * onboards it once; every run after that reuses the cached profile.
 *
 * The MetaMask equivalents live in `metamask-connect.spec.ts` and assert the
 * same outcomes. What differs is underneath: Zerion raises its approval as a
 * dialog page the driver has to catch rather than a route it can open.
 */

import { expect } from '@playwright/test'
import { mnemonicToAccount } from 'viem/accounts'
import { test } from '../fixtures/zerion.js'
import { LAB_TIMEOUT_MS } from '../helpers/constants.js'
import {
  expectSignRunRejected,
  expectSignRunSucceeded,
} from '../helpers/tx-runs.js'
import { openWalletPreset } from '../helpers/ui-login.js'
import { TEST_WALLET } from '../helpers/wallet-credentials.js'
import { openZerionSheet } from '../helpers/zerion/connect.js'

/** The address `TEST_WALLET`'s phrase derives, which is what the lab should show. */
const expectedAddress = () =>
  mnemonicToAccount(TEST_WALLET.secretRecoveryPhrase).address

/** Gets the lab to the wallet list, capped so the row set is deterministic. */
async function openWalletList(page: import('@playwright/test').Page) {
  await openWalletPreset(page, { maxWallets: 2 })
  await openZerionSheet(page)
}

test.describe('Preset 2 — real Zerion', () => {
  test.describe.configure({ timeout: 120_000 })

  test('the announced row is badged INSTALLED once the extension is present', async ({
    page,
  }) => {
    await openWalletList(page)

    const zerionRow = page.getByRole('button', { name: /^Zerion/ })
    await expect(zerionRow).toBeVisible()
    await expect(zerionRow).toContainText('INSTALLED')
    await expect(zerionRow).toHaveCount(1)
  })

  test('approving the request connects the announced account', async ({
    page,
    zerion,
  }) => {
    await openWalletList(page)

    await page.getByRole('button', { name: /^Zerion/ }).click()
    await zerion.approveConnection()

    const shown = page.getByTestId('wallet-address')
    await expect(shown).toBeVisible({ timeout: LAB_TIMEOUT_MS })

    expect((await shown.innerText()).trim().toLowerCase()).toBe(
      expectedAddress().toLowerCase(),
    )
  })

  test('signs a message with the connected external wallet', async ({
    page,
    zerion,
  }) => {
    await openWalletList(page)
    await page.getByRole('button', { name: /^Zerion/ }).click()
    await zerion.approveConnection()
    await expect(page.getByTestId('wallet-address')).toBeVisible({
      timeout: LAB_TIMEOUT_MS,
    })

    await page.getByTestId('nav-feature-tx-signing').click()
    await expect(page.getByTestId('area-signing')).toBeVisible()

    await page
      .getByTestId('case-sign-message-presets')
      .getByTestId('sign-message-submit')
      .click()

    await zerion.approveSignature()

    await expectSignRunSucceeded(page.getByTestId('sign-run-1'))
  })

  test('rejecting the signature reports the rejection on the sign run', async ({
    page,
    zerion,
  }) => {
    await openWalletList(page)
    await page.getByRole('button', { name: /^Zerion/ }).click()
    await zerion.approveConnection()
    await expect(page.getByTestId('wallet-address')).toBeVisible({
      timeout: LAB_TIMEOUT_MS,
    })

    await page.getByTestId('nav-feature-tx-signing').click()
    await expect(page.getByTestId('area-signing')).toBeVisible()

    await page
      .getByTestId('case-sign-message-presets')
      .getByTestId('sign-message-submit')
      .click()

    await zerion.rejectSignature()

    await expectSignRunRejected(page.getByTestId('sign-run-1'))
  })

  test('rejecting the request leaves the lab unconnected', async ({
    page,
    zerion,
  }) => {
    await openWalletList(page)

    await page.getByRole('button', { name: /^Zerion/ }).click()
    await zerion.rejectPendingRequest()

    // A decline holds the connecting step and explains itself rather than
    // dropping back to the wallet list. Asserting the title is what proves a
    // real extension rejection reaches `isCancellationError` — the other
    // `describeConnectError` branches blame the wallet or report a generic
    // failure.
    await expect(page.getByText('Request declined')).toBeVisible({
      timeout: LAB_TIMEOUT_MS,
    })
    await expect(page.getByTestId('wallet-address')).toBeHidden()
  })
})
