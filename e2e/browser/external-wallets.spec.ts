/**
 * Browser E2E for external wallets
 *
 * **The preset selects this screen.** Every test opens `?preset=preset-2` and
 * asserts a wallet row preset 1 never renders, so a broken preset resolution
 * fails here instead of falling back to passkey, Google and email.
 *
 * These need a live WalletConnect relay and
 * `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`, because the pairing URI comes from
 * the relay. A relay outage turns them red on purpose. Skipping would report a
 * green run for a screen nobody exercised.
 */

import type { Locator, Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import {
  announceMockWallets,
  MOCK_WALLET,
  MOCK_WALLET_TWO,
} from '../helpers/mock-injected-wallet.js'

/** The relay round-trip, plus a cold Next dev compile on the first spec. */
const PAIRING_TIMEOUT_MS = 60_000

/**
 * A usable WalletConnect v2 pairing URI, `wc:<topic>@<version>?...symKey=...`.
 *
 * Tighter than "starts with `wc:`" on purpose. A truncated or empty pairing
 * satisfies the prefix, renders a QR that looks scannable, and pairs with
 * nothing. `symKey` is what lets the URI establish a session.
 */
const PAIRING_URI = /^wc:[0-9a-f]+@\d+\?.*symKey=[0-9a-f]+/

/**
 * Opens the lab on preset 2 and waits for the sign-up screen.
 *
 * The URL is what a spec can set, and it writes through to storage, so this
 * also leaves the lab on preset 2 for anything that navigates afterwards.
 */
async function openPresetTwo(page: Page): Promise<void> {
  await page.goto('/?preset=preset-2')
  await expect(page.getByText('Continue to your wallet')).toBeVisible({
    timeout: PAIRING_TIMEOUT_MS,
  })
}

/**
 * Asserts the sheet's QR encodes `expectedPrefix` followed by a usable pairing
 * URI.
 *
 * The QR is an `<svg role="img">` whose accessible name is the encoded value,
 * so a test can read the payload without inspecting pixels. Waiting on that
 * name also waits out the spinner the sheet shows until the relay answers.
 */
async function expectQrEncoding(
  sheet: Locator,
  /** Empty string for the generic sheet, which encodes the bare URI. */
  expectedPrefix: string,
): Promise<void> {
  const qr = sheet.getByRole('img', { name: /^QR code for / })
  await expect(qr).toBeVisible({ timeout: PAIRING_TIMEOUT_MS })

  const label = await qr.getAttribute('aria-label')
  const encoded = label?.replace(/^QR code for /, '') ?? ''

  // `startsWith` rather than `contains`. The wrapper has to be the outermost
  // thing, or a double-wrapped payload would pass while scanning elsewhere.
  expect(
    encoded.startsWith(expectedPrefix),
    `QR should start with "${expectedPrefix}", got: ${encoded.slice(0, 100)}`,
  ).toBe(true)

  // Whatever prefix sits in front, what follows has to be a pairing URI that
  // could establish a session.
  const uri = decodeURIComponent(encoded.slice(expectedPrefix.length))
  expect(
    uri,
    `payload after "${expectedPrefix}" is not a usable pairing URI`,
  ).toMatch(PAIRING_URI)
}

/**
 * Asserts the Browser tab offers the vendor download page.
 *
 * The attributes are asserted, not a click. Following the link would test
 * whether the vendor's site is up, which is not this suite's job. `target` and
 * `rel` are the part we own, and `_blank` without `noopener` on a third-party
 * link is a real defect.
 */
async function expectDownloadLink(
  sheet: Locator,
  walletName: string,
  downloadUrl: string,
): Promise<void> {
  await sheet.getByRole('button', { name: 'Browser' }).click()

  const link = sheet.getByRole('link', { name: `Get ${walletName}` })
  await expect(link).toBeVisible()
  await expect(link).toHaveAttribute('href', downloadUrl)
  await expect(link).toHaveAttribute('target', '_blank')
  await expect(link).toHaveAttribute('rel', /noopener/)
}

test.describe('Preset 2 — external wallets', () => {
  // Two 60s waits can stack in one test, a cold compile then the relay, and
  // the config's 120s default leaves no headroom above that.
  test.describe.configure({ timeout: 180_000 })

  test('pinned MetaMask row pairs by deep link and offers the download page', async ({
    page,
  }) => {
    await openPresetTwo(page)

    await page.getByRole('button', { name: /^MetaMask/ }).click()

    const sheet = page.getByRole('dialog', { name: 'Connect MetaMask' })
    await expect(sheet).toBeVisible()

    await expectQrEncoding(sheet, 'https://metamask.app.link/wc?uri=')

    await expectDownloadLink(sheet, 'MetaMask', 'https://metamask.io/download')
  })

  test('a wallet chosen from More wallets pairs the same way', async ({
    page,
  }) => {
    await openPresetTwo(page)

    await page.getByRole('button', { name: /^More wallets/ }).click()

    const grid = page.getByRole('dialog', { name: 'All wallets' })
    await expect(grid).toBeVisible()
    await grid.getByRole('button', { name: 'Trust Wallet' }).click()

    const sheet = page.getByRole('dialog', { name: 'Connect Trust Wallet' })
    await expect(sheet).toBeVisible()
    await expect(grid).toBeHidden()

    await expectQrEncoding(sheet, 'trust://wc?uri=')

    await expectDownloadLink(
      sheet,
      'Trust Wallet',
      'https://trustwallet.com/download',
    )
  })

  test('the WalletConnect row pairs with a raw URI and offers no wallet tabs', async ({
    page,
  }) => {
    await openPresetTwo(page)

    await page.getByRole('button', { name: /^WalletConnect/ }).click()

    const sheet = page.getByRole('dialog', { name: 'WalletConnect' })
    await expect(sheet).toBeVisible()

    await expect(sheet.getByRole('button', { name: 'Mobile' })).toBeHidden()
    await expect(sheet.getByRole('button', { name: 'Browser' })).toBeHidden()

    // Empty prefix. The bare URI, so any wallet's in-app scanner can claim the
    // pairing rather than one vendor's.
    await expectQrEncoding(sheet, '')
  })

  test('an EIP-6963 announcement is discovered and listed as installed', async ({
    page,
  }) => {
    await announceMockWallets(page, [MOCK_WALLET, MOCK_WALLET_TWO])
    await openPresetTwo(page)

    const row = page.getByRole('button', { name: new RegExp(MOCK_WALLET.name) })
    await expect(row).toHaveCount(1)
    await expect(row).toBeVisible()

    await expect(row).toContainText('INSTALLED')

    await expect(
      page.getByRole('button', { name: new RegExp(MOCK_WALLET_TWO.name) }),
    ).toBeVisible()

    await expect(row).not.toContainText(MOCK_WALLET_TWO.name)

    const metamask = page.getByRole('button', { name: /^MetaMask/ })
    await expect(metamask).toBeVisible()
    await expect(metamask).not.toContainText('INSTALLED')
  })
})
