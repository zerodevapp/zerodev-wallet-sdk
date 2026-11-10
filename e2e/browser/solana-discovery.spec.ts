/**
 * Browser E2E for Solana discovery through mocked wallets, with no extension.
 */

import { expect, test } from '@playwright/test'
import {
  connector,
  expectConnected,
  expectDisconnected,
} from '../helpers/connector-bar.js'
import { LAB_TIMEOUT_MS } from '../helpers/constants.js'
import {
  announceMockWallets,
  type MockWallet,
} from '../helpers/mock-injected-wallet.js'
import {
  disableMockSolanaWallets,
  MOCK_SOLANA_WALLET,
  registerMockSolanaWallets,
} from '../helpers/mock-solana-wallet.js'
import {
  expectSignUpSheet,
  openSignIn,
  openWalletPreset,
} from '../helpers/ui-login.js'

/**
 * Three wallets that sit in `WALLET_GUIDE`, so they rank above anything the
 * guide does not list. With the mock Solana wallet that makes a four-row list,
 * and `maxWallets` of 3 then 4 puts the cut on either side of the Solana row
 * without changing anything else.
 */
const GUIDE_WALLETS: MockWallet[] = [
  { rdns: 'com.trustwallet.app', name: 'Trust Wallet' },
  { rdns: 'com.coinbase.wallet', name: 'Coinbase Wallet' },
  { rdns: 'io.rabby', name: 'Rabby Wallet' },
]

const solanaRow = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: new RegExp(`^${MOCK_SOLANA_WALLET.name}`) })

/**
 * The rows `maxWallets` caps, in render order. The INSTALLED badge is what
 * separates them from the pinned, More wallets and WalletConnect rows, which
 * are their own units and are never capped.
 */
const installedRows = (page: import('@playwright/test').Page) =>
  page.getByTestId('connect-wallet').getByRole('button').filter({
    hasText: 'INSTALLED',
  })

test.describe('Solana discovery with mocked wallets', () => {
  test.describe.configure({ timeout: 180_000 })

  test('a saved wallet that is gone on the next load settles the restore', async ({
    page,
  }) => {
    await registerMockSolanaWallets(page, [MOCK_SOLANA_WALLET])
    await openWalletPreset(page, { solana: true })

    await openSignIn(page, 'solana')
    await expectSignUpSheet(page)

    await solanaRow(page).click()
    await expectConnected(page, 'solana')

    // Prove the restore works while the wallet is present
    await page.reload()
    await expectConnected(page, 'solana')

    await disableMockSolanaWallets(page)
    await page.reload()

    // The saved session is still stored
    await expect(page.getByTestId('connector-status')).toHaveAttribute(
      'data-reconnecting',
      'false',
      { timeout: LAB_TIMEOUT_MS },
    )
    await expectDisconnected(page, 'solana')

    await expect(connector(page, 'solana')).toHaveAttribute(
      'data-wallets-count',
      '0',
    )
  })

  test('the Solana wallet is the row a tight maxWallets drops', async ({
    page,
  }) => {
    await announceMockWallets(page, GUIDE_WALLETS)
    await registerMockSolanaWallets(page, [MOCK_SOLANA_WALLET])
    await openWalletPreset(page, { solana: true, maxWallets: 3 })

    // Discovery is independent of the list: the kit holds the wallet whether
    // or not the sheet has room for it, so an absent row below is the ranking
    // and never a wallet that went unseen.
    await expect(connector(page, 'solana')).toHaveAttribute(
      'data-wallets',
      MOCK_SOLANA_WALLET.name,
      { timeout: LAB_TIMEOUT_MS },
    )

    await openSignIn(page, 'solana')
    await expectSignUpSheet(page)

    // Three EVM wallets fill the cap, and the one dropped is the Solana row.
    await expect(installedRows(page)).toHaveCount(3, {
      timeout: LAB_TIMEOUT_MS,
    })
    for (const wallet of GUIDE_WALLETS) {
      await expect(
        page.getByRole('button', { name: new RegExp(`^${wallet.name}`) }),
      ).toBeVisible()
    }
    await expect(solanaRow(page)).toHaveCount(0)

    // The namespace is still wired
    await expect(
      page
        .getByRole('button', { name: /^WalletConnect/ })
        .filter({ hasText: 'SOLANA' }),
    ).toBeVisible()
  })

  test('one more slot brings it back, last in the list', async ({ page }) => {
    await announceMockWallets(page, GUIDE_WALLETS)
    await registerMockSolanaWallets(page, [MOCK_SOLANA_WALLET])
    await openWalletPreset(page, { solana: true, maxWallets: 4 })

    await openSignIn(page, 'solana')
    await expectSignUpSheet(page)

    // Same wallets, one more slot: the row appears, which puts the cause in
    // ranking rather than discovery. Its position is the ranking itself.
    const rows = installedRows(page)
    await expect(rows).toHaveCount(4, { timeout: LAB_TIMEOUT_MS })
    await expect(rows.last()).toContainText(MOCK_SOLANA_WALLET.name)
  })
})
