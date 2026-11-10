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
import { connector } from '../helpers/connector-bar.js'
import {
  announceMockWallets,
  MOCK_WALLET,
  MOCK_WALLET_TWO,
} from '../helpers/mock-injected-wallet.js'
import {
  MOCK_SOLANA_WALLET,
  registerMockSolanaWallets,
} from '../helpers/mock-solana-wallet.js'
import {
  expectSignUpSheet,
  openSignIn,
  openWalletPreset,
} from '../helpers/ui-login.js'

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
 * Whether the running lab build has a WalletConnect project id, resolved once
 * per worker.
 */
let walletConnectConfigured: Promise<boolean> | undefined

async function isWalletConnectConfigured(page: Page): Promise<boolean> {
  await page.goto('/environment')
  const pill = page.getByTestId('env-NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID')
  await expect(pill).toBeVisible({ timeout: PAIRING_TIMEOUT_MS })
  return (await pill.getAttribute('data-pass')) === 'true'
}

/**
 * Fails every case in this spec whenever the WalletConnect ProjectId hasn't
 * been set on the build step. This also gets annotated so that it is easier to
 * triage.
 */
test.beforeEach(async ({ page }) => {
  // Cleared on rejection so a transient failure reaching `/environment` is
  // retried by the next case rather than remembered for the whole worker.
  walletConnectConfigured ??= isWalletConnectConfigured(page).catch(
    (error: unknown) => {
      walletConnectConfigured = undefined
      throw error
    },
  )
  if (await walletConnectConfigured) return

  const detail =
    'NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not set in the lab build, so no ' +
    'WalletConnect connector is registered and these rows do not render. Set it ' +
    'on the QA lab build step.'
  test.info().annotations.push({ type: 'config-missing', description: detail })
  throw new Error(detail)
})

/** Opens the lab on preset 2 and waits for the sign-up screen. */
async function openPresetTwo(
  page: Page,
  /** Offers the Solana rows beside the EVM ones. */
  withSolana = false,
): Promise<void> {
  await openWalletPreset(page, { solana: withSolana })
  await openSignIn(page, withSolana ? 'solana' : 'eip155')
  await expectSignUpSheet(page)
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

  // OKX is the pinned row, and is installed in no project here, so clicking it
  // takes the handoff branch: no EIP-6963 announcement means pair by deep link
  // rather than connect. An installed wallet would connect instead and never
  // reach this sheet.
  test('pinned OKX row pairs by deep link and offers the download page', async ({
    page,
  }) => {
    await openPresetTwo(page)

    await page.getByRole('button', { name: /^OKX Wallet/ }).click()

    const sheet = page.getByRole('dialog', { name: 'Connect OKX Wallet' })
    await expect(sheet).toBeVisible()

    await expectQrEncoding(sheet, 'okex://main/wc?uri=')

    await expectDownloadLink(sheet, 'OKX Wallet', 'https://okx.com/download')
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

  test('TC-02 — the Solana WalletConnect row offers a usable pairing', async ({
    page,
  }) => {
    await openPresetTwo(page, true)

    // Both doors are titled "WalletConnect"; only the badge tells them apart.
    const solanaRow = page
      .getByRole('button', { name: /^WalletConnect/ })
      .filter({ hasText: 'SOLANA' })
    await expect(solanaRow).toHaveCount(1)
    await solanaRow.click()

    const sheet = page.getByRole('dialog', { name: 'WalletConnect' })
    await expect(sheet).toBeVisible()

    // Scanning starts in a Solana wallet's own scanner, so the payload is the
    // bare URI rather than a vendor deep link.
    await expectQrEncoding(sheet, '')
  })

  test('the connector flag alone opens the Solana door with no Solana wallet list', async ({
    page,
  }) => {
    await registerMockSolanaWallets(page, [MOCK_SOLANA_WALLET])
    await openWalletPreset(page, { solana: true, namespaces: ['eip155'] })
    await openSignIn(page, 'eip155')
    await expectSignUpSheet(page)

    // The door the connector flag opens. Both rows are titled "WalletConnect"
    // and only the badge separates them, so the count carries as much of the
    // assertion as the badge does.
    const walletConnectRows = page.getByRole('button', {
      name: /^WalletConnect/,
    })
    await expect(walletConnectRows).toHaveCount(2)
    await expect(walletConnectRows.filter({ hasText: 'SOLANA' })).toHaveCount(1)

    // Discovered and still not offered. Reading the bar first is what makes the
    // missing row attributable to the wallet list's default `['eip155']` rather
    // than to a mock that never registered.
    await expect(connector(page, 'solana')).toHaveAttribute(
      'data-wallets',
      MOCK_SOLANA_WALLET.name,
    )
    await expect(
      page.getByRole('button', {
        name: new RegExp(`^${MOCK_SOLANA_WALLET.name}`),
      }),
    ).toHaveCount(0)
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

    const okx = page.getByRole('button', { name: /^OKX Wallet/ })
    await expect(okx).toBeVisible()
    await expect(okx).not.toContainText('INSTALLED')
  })
})
