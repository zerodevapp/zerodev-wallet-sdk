/**
 * Browser E2E for disconnecting one namespace while the other survives.
 *
 * Per-namespace, both ways. One extension serves both chains.
 */

import { expect } from '@playwright/test'
import { test } from '../fixtures/metamask.js'
import {
  addressOf,
  connector,
  expectConnected,
  expectDisconnected,
  openDisconnectDialog,
} from '../helpers/connector-bar.js'
import { LAB_TIMEOUT_MS } from '../helpers/constants.js'
import { connectThroughMetaMask } from '../helpers/metamask/connect.js'
import { openWalletPreset } from '../helpers/ui-login.js'

test.describe('Per-namespace disconnect through MetaMask', () => {
  test.describe.configure({ timeout: 300_000 })

  /** Leaves both namespaces connected through the one extension. */
  test.beforeEach(async ({ page, metamask }) => {
    await openWalletPreset(page, { solana: true })
    await connectThroughMetaMask(page, metamask, 'solana')
    await connectThroughMetaMask(page, metamask, 'eip155')
  })

  test('disconnecting Solana leaves the EVM connection up', async ({
    page,
  }) => {
    const evmAddress = await addressOf(page, 'eip155')

    const dialog = await openDisconnectDialog(page)
    await expect(dialog).toHaveAttribute('data-solana-connected', 'true')
    await dialog.getByTestId('disconnect-solana').click()

    await expectDisconnected(page, 'solana')
    await expectConnected(page, 'eip155')
    expect(await addressOf(page, 'eip155')).toBe(evmAddress)

    // The session as a whole is still live, which is what keeps the lab open.
    await expect(page.getByTestId('connector-status')).toHaveAttribute(
      'data-connected',
      'true',
    )
  })

  test('disconnecting EVM leaves the Solana connection up', async ({
    page,
  }) => {
    const solanaAddress = await addressOf(page, 'solana')

    const dialog = await openDisconnectDialog(page)
    await expect(dialog).toHaveAttribute('data-evm-connected', 'true')
    await dialog.getByTestId('disconnect-eip155').click()

    await expectDisconnected(page, 'eip155')
    await expectConnected(page, 'solana')
    expect(await addressOf(page, 'solana')).toBe(solanaAddress)
    await expect(connector(page, 'solana')).toHaveAttribute(
      'data-wallet',
      'MetaMask',
    )
  })

  test('EVM reconnects after an in-app disconnect, with a fresh approval', async ({
    page,
    metamask,
  }) => {
    const evmAddress = await addressOf(page, 'eip155')

    const dialog = await openDisconnectDialog(page)
    await dialog.getByTestId('disconnect-eip155').click()
    await expectDisconnected(page, 'eip155')

    await connectThroughMetaMask(page, metamask, 'eip155')

    expect(await addressOf(page, 'eip155')).toBe(evmAddress)
    await expectConnected(page, 'solana')
  })

  test('disconnecting both leaves nothing to restore', async ({ page }) => {
    const dialog = await openDisconnectDialog(page)
    await dialog.getByTestId('disconnect-all').click()

    // Disconnect-all reloads onto the active config rather than a bare "/", so
    // Solana is still offered on the page that comes back.
    await expectDisconnected(page, 'solana')
    await expectDisconnected(page, 'eip155')
    await expect(page.getByTestId('connector-status')).toHaveAttribute(
      'data-connected',
      'false',
    )

    // A reload must not bring either side back, which is what separates a
    // disconnect from merely clearing the view.
    await page.reload()
    await expect(page.getByTestId('connector-status')).toHaveAttribute(
      'data-reconnecting',
      'false',
      { timeout: LAB_TIMEOUT_MS },
    )
    await expectDisconnected(page, 'solana')
    await expectDisconnected(page, 'eip155')
  })
})
