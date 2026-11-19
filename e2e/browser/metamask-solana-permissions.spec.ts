/**
 * Browser E2E for the grant itself, read from MetaMask's own connected-sites
 * list rather than from the app.
 */

import { expect } from '@playwright/test'
import { test } from '../fixtures/metamask.js'
import {
  expectConnected,
  expectDisconnected,
  openDisconnectDialog,
} from '../helpers/connector-bar.js'
import { connectThroughMetaMask } from '../helpers/metamask/connect.js'
import { openWalletPreset } from '../helpers/ui-login.js'

/** The origin the lab is served from, as the wallet records it. */
const originOf = (url: string) => new URL(url).host

test.describe('Solana permissions through MetaMask', () => {
  test.describe.configure({ timeout: 300_000 })

  test('a revoke in the wallet takes both namespaces down', async ({
    page,
    metamask,
  }) => {
    await openWalletPreset(page, { solana: true })
    await connectThroughMetaMask(page, metamask, 'solana')
    await connectThroughMetaMask(page, metamask, 'eip155')

    await metamask.disconnectAllSites()

    // No reload. The wallet's revoke based on origin, and the app has to
    // reflect it on its own rather than keep showing a connection that no
    // longer exists — a stale connected state is the failure this case is
    // about.
    await expectDisconnected(page, 'solana')
    await expectDisconnected(page, 'eip155')
    await expect(page.getByTestId('connector-status')).toHaveAttribute(
      'data-connected',
      'false',
    )
  })

  test('disconnecting in the app clears the grant in the wallet', async ({
    page,
    metamask,
  }) => {
    await openWalletPreset(page, { solana: true })
    await connectThroughMetaMask(page, metamask, 'solana')
    await expectConnected(page, 'solana')

    const origin = originOf(page.url())

    // Proves the wallet recorded the grant, so the assertion after the
    // disconnect is about the disconnect rather than about a list that was
    // empty all along.
    await metamask.expectSiteConnected(origin)

    const dialog = await openDisconnectDialog(page)
    await dialog.getByTestId('disconnect-all').click()
    await expectDisconnected(page, 'solana')

    await metamask.expectSiteNotConnected(origin)
  })
})
