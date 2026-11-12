/**
 * Browser E2E for the Solana namespace through a real MetaMask extension.
 */

import { expect } from '@playwright/test'
import { test } from '../fixtures/metamask.js'
import {
  addressOf,
  connector,
  expectConnected,
  expectDisconnected,
} from '../helpers/connector-bar.js'
import {
  BASE58_ADDRESS,
  EVM_ADDRESS,
  LAB_TIMEOUT_MS,
} from '../helpers/constants.js'
import { connectThroughMetaMask } from '../helpers/metamask/connect.js'
import {
  expectSignUpSheet,
  openSignIn,
  openWalletPreset,
} from '../helpers/ui-login.js'

/**
 * The WalletConnect relay round-trip that fills the pairing QR. Longer than
 * `LAB_TIMEOUT_MS` because it leaves the machine.
 */
const PAIRING_TIMEOUT_MS = 60_000

test.describe('Solana through MetaMask', () => {
  test.describe.configure({ timeout: 300_000 })

  test('an installed Solana wallet connects into its own slot', async ({
    page,
    metamask,
  }) => {
    await openWalletPreset(page, { solana: true })
    await connectThroughMetaMask(page, metamask, 'solana')

    const solana = connector(page, 'solana')
    await expect(solana).toHaveAttribute('data-address', BASE58_ADDRESS)
    await expect(solana).toHaveAttribute('data-wallet', 'MetaMask')
    await expect(solana).toHaveAttribute(
      'data-wallet-source',
      'wallet-standard',
    )
    await expect(page.getByTestId('connector-status')).toHaveAttribute(
      'data-connected',
      'true',
    )

    // The point of the case: a Solana connect leaves the EVM side alone, even
    // though the same extension serves it.
    await expectDisconnected(page, 'eip155')
  })

  test('Solana first, then EVM on the same wallet', async ({
    page,
    metamask,
  }) => {
    await openWalletPreset(page, { solana: true })
    await connectThroughMetaMask(page, metamask, 'solana')
    const solanaAddress = await addressOf(page, 'solana')

    await connectThroughMetaMask(page, metamask, 'eip155')

    // The second connect must not drop the first.
    await expectConnected(page, 'solana')
    expect(await addressOf(page, 'solana')).toBe(solanaAddress)
    await expect(connector(page, 'eip155')).toHaveAttribute(
      'data-address',
      EVM_ADDRESS,
    )
  })

  test('EVM first, then Solana on the same wallet', async ({
    page,
    metamask,
  }) => {
    await openWalletPreset(page, { solana: true })
    await connectThroughMetaMask(page, metamask, 'eip155')
    const evmAddress = await addressOf(page, 'eip155')

    // No second prompt in this direction. MetaMask's EVM approval already
    // authorises the site for Solana, so the Solana connect resolves straight
    // from the existing grant.
    await connectThroughMetaMask(page, metamask, 'solana', false)

    // The EVM connection from step 1 is still the current one, not replaced.
    await expectConnected(page, 'eip155')
    expect(await addressOf(page, 'eip155')).toBe(evmAddress)
    await expect(connector(page, 'solana')).toHaveAttribute(
      'data-address',
      BASE58_ADDRESS,
    )
  })

  test('a Solana connect does not light up the wallet EVM side', async ({
    page,
    metamask,
  }) => {
    await openWalletPreset(page, { solana: true })
    await connectThroughMetaMask(page, metamask, 'solana')

    await page.waitForTimeout(2000)
    await expectDisconnected(page, 'eip155')

    await page.reload()
    await expectConnected(page, 'solana')
    await expect(page.getByTestId('connector-status')).toHaveAttribute(
      'data-reconnecting',
      'false',
      { timeout: LAB_TIMEOUT_MS },
    )
    await expectDisconnected(page, 'eip155')
  })

  test('a closed Solana pairing sheet leaves the next wallet connectable', async ({
    page,
    metamask,
  }) => {
    await openWalletPreset(page, { solana: true })
    await openSignIn(page, 'solana')
    await expectSignUpSheet(page)

    const solana = connector(page, 'solana')

    const solanaDoor = page
      .getByRole('button', { name: /^WalletConnect/ })
      .filter({ hasText: 'SOLANA' })
    await expect(
      solanaDoor,
      'the Solana WalletConnect door is missing — is ' +
        'NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID set on the lab build step?',
    ).toHaveCount(1)
    await solanaDoor.click()

    const sheet = page.getByRole('dialog', { name: 'WalletConnect' })
    await expect(sheet).toBeVisible()

    await expect(sheet.getByRole('img', { name: /^QR code for / })).toBeVisible(
      { timeout: PAIRING_TIMEOUT_MS },
    )
    await expect(solana).toHaveAttribute('data-status', 'connecting')

    await sheet.getByRole('button', { name: 'Close' }).click()
    await expect(sheet).toBeHidden()

    await expect(solana).toHaveAttribute('data-status', 'disconnected', {
      timeout: LAB_TIMEOUT_MS,
    })

    await expectSignUpSheet(page)

    const metamaskRow = page.getByRole('button', { name: /^MetaMask/ })
    await metamaskRow.click()
    const choice = page.getByTestId('chain-choice-MetaMask')
    await expect(choice).toBeVisible({ timeout: LAB_TIMEOUT_MS })
    await choice.getByRole('button', { name: /^Solana/ }).click()

    await expect(metamaskRow).toContainText('CONNECTING', {
      timeout: LAB_TIMEOUT_MS,
    })

    await metamask.approveConnection()

    await expect(solana).toHaveAttribute('data-status', 'connected', {
      timeout: LAB_TIMEOUT_MS,
    })
    await expect(solana).toHaveAttribute('data-address', BASE58_ADDRESS)
    await expect(solana).toHaveAttribute('data-wallet', 'MetaMask')

    await expect(solana).toHaveAttribute(
      'data-wallet-source',
      'wallet-standard',
    )
  })

  test('closing the sheet reports a dismissal, not a failure', async ({
    page,
  }) => {
    await openWalletPreset(page, { solana: true })
    await openSignIn(page, 'solana')
    await expectSignUpSheet(page)

    // Positional: the SDK's close button carries no accessible name and Screen
    // exposes no dialog role, so there is nothing to address it by. On the
    // sign-up step the left nav slot is a spacer, leaving the close as the
    // first button in the sheet. A wrong target leaves the sheet open and the
    // assertions below fail, so the locator cannot pass by accident.
    await page.getByTestId('connect-wallet').locator('button').first().click()

    await expect(page.getByText('Continue to your wallet')).toBeHidden()

    const error = page.getByTestId('connector-error')
    await expect(error).toBeVisible()
    await expect(error).toHaveAttribute(
      'data-error-name',
      'AuthFlowDismissedError',
    )
    await expect(error).toHaveAttribute('data-cancellation', 'true')
    await expect(error).toHaveAttribute('data-namespace', 'solana')

    await expectDisconnected(page, 'solana')
    await expectDisconnected(page, 'eip155')
  })

  test('an installed Solana wallet restores silently', async ({
    page,
    metamask,
  }) => {
    await openWalletPreset(page, { solana: true })
    await connectThroughMetaMask(page, metamask, 'solana')
    const before = await addressOf(page, 'solana')

    await page.reload()

    // No approval is driven here on purpose. A restore that prompted would
    // leave the request unanswered and never reach `connected`, so reaching it
    // is the proof that nothing was asked of the wallet.
    await expectConnected(page, 'solana')
    expect(await addressOf(page, 'solana')).toBe(before)
    await expect(connector(page, 'solana')).toHaveAttribute(
      'data-wallet',
      'MetaMask',
    )
  })

  test('the reconnecting window always settles', async ({ page, metamask }) => {
    const status = page.getByTestId('connector-status')

    // Nothing saved: the window still has to close.
    await openWalletPreset(page, { solana: true })
    await expect(status).toHaveAttribute('data-reconnecting', 'false', {
      timeout: LAB_TIMEOUT_MS,
    })
    await expect(status).toHaveAttribute('data-connected', 'false')

    // With a session saved it may hold while the restore runs, but it must
    // still reach an outcome rather than staying true for the page's life.
    await connectThroughMetaMask(page, metamask, 'solana')
    await page.reload()
    await expect(status).toHaveAttribute('data-reconnecting', 'false', {
      timeout: LAB_TIMEOUT_MS,
    })
    await expectConnected(page, 'solana')
  })

  test('both namespaces persist across a reload', async ({
    page,
    metamask,
  }) => {
    await openWalletPreset(page, { solana: true })
    await connectThroughMetaMask(page, metamask, 'solana')
    await connectThroughMetaMask(page, metamask, 'eip155')

    const solanaAddress = await addressOf(page, 'solana')
    const evmAddress = await addressOf(page, 'eip155')

    await page.reload()

    await expectConnected(page, 'solana')
    await expectConnected(page, 'eip155')
    expect(await addressOf(page, 'solana')).toBe(solanaAddress)
    expect(await addressOf(page, 'eip155')).toBe(evmAddress)
  })

  test('Solana in namespaces with no solana flag on the connector', async ({
    page,
  }) => {
    await page.goto('/?preset=preset-2&ns=eip155,solana')
    await openSignIn(page, 'solana')
    await expectSignUpSheet(page)

    // Wallet Standard discovery does not depend on the connector flag, so the
    // installed wallet still offers its Solana side.
    const metamaskRow = page.getByRole('button', { name: /^MetaMask/ })
    await expect(metamaskRow).toBeVisible()
    await expect(metamaskRow).toContainText('SOLANA')

    const walletConnectRows = page.getByRole('button', {
      name: /^WalletConnect/,
    })
    await expect(walletConnectRows).toHaveCount(1)
    await expect(walletConnectRows).not.toContainText('SOLANA')
  })

  test('an EVM-only session persists across a reload', async ({
    page,
    metamask,
  }) => {
    await openWalletPreset(page, { solana: true })
    await connectThroughMetaMask(page, metamask, 'eip155')
    const evmAddress = await addressOf(page, 'eip155')

    await page.reload()

    await expectConnected(page, 'eip155')
    expect(await addressOf(page, 'eip155')).toBe(evmAddress)
    await expectDisconnected(page, 'solana')
  })
})
