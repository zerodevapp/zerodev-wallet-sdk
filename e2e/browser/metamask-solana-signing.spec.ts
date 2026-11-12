/**
 * Browser E2E for Solana signing, relayed to a real MetaMask extension.
 *
 * MetaMask only. The point of these is that a real wallet raises its own
 * prompt and returns bytes the kit never produced, which a mock cannot show.
 */

import { expect } from '@playwright/test'
import { test } from '../fixtures/metamask.js'
import { expectConnected } from '../helpers/connector-bar.js'
import { LAB_TIMEOUT_MS } from '../helpers/constants.js'
import { openTxSigningArea } from '../helpers/lab-nav.js'
import { connectThroughMetaMask } from '../helpers/metamask/connect.js'
import { expectSignRunSucceeded } from '../helpers/tx-runs.js'
import { openWalletPreset } from '../helpers/ui-login.js'

/** Hex, lowercase, no `0x` — Solana returns raw bytes rather than EVM words. */
const SOLANA_SIGNATURE = /^[0-9a-f]+$/

/** Distinctive, so finding it in the wallet proves it travelled there. */
const MESSAGE = 'TC-09 relay check'

test.describe('Solana signing through MetaMask', () => {
  test.describe.configure({ timeout: 300_000 })

  test('a Solana sign message is relayed to the wallet and returns a signature', async ({
    page,
    metamask,
  }) => {
    await openWalletPreset(page, { solana: true })
    await connectThroughMetaMask(page, metamask, 'solana')
    await openTxSigningArea(page, 'signing')

    const card = page.getByTestId('case-solana-signing')
    await expect(card).toHaveAttribute('data-connected', 'true')

    // The handle offers the method only when the wallet and the connected
    // account both declare it, so this is the precondition for the click
    // rather than decoration.
    await expect(page.getByTestId('solana-handle-signMessage')).toHaveAttribute(
      'data-available',
      'true',
    )

    await page.getByTestId('solana-message-input').fill(MESSAGE)
    await page.getByTestId('solana-fire-signMessage').click()

    // The wallet raises its own prompt, showing the message the app sent.
    await metamask.approveSignature(MESSAGE)

    const run = page.getByTestId('solana-sign-run-1')
    await expect(run).toHaveAttribute('data-status', 'success', {
      timeout: LAB_TIMEOUT_MS,
    })

    const signature = await run.getAttribute('data-output')
    expect(signature).toMatch(SOLANA_SIGNATURE)

    // The absent attribute is the assertion: the lab sets it only where the
    // bytes the wallet signed differ from the bytes sent, so a wallet that
    // prefixed the message would fail here.
    await expect(run).not.toHaveAttribute('data-wallet-signed', /./)
  })

  test('EVM and Solana sign one after the other, neither disturbing the other', async ({
    page,
    metamask,
  }) => {
    await openWalletPreset(page, { solana: true })
    await connectThroughMetaMask(page, metamask, 'solana')
    await connectThroughMetaMask(page, metamask, 'eip155')
    await openTxSigningArea(page, 'signing')

    await page
      .getByTestId('case-sign-message-presets')
      .getByTestId('sign-message-submit')
      .click()
    await metamask.approveSignature()
    await expectSignRunSucceeded(page.getByTestId('sign-run-1'))

    await page.getByTestId('solana-fire-signMessage').click()
    await metamask.approveSignature()

    const solanaRun = page.getByTestId('solana-sign-run-1')
    await expect(solanaRun).toHaveAttribute('data-status', 'success', {
      timeout: LAB_TIMEOUT_MS,
    })

    // Each namespace returns its own shape, which is what says the two paths
    // stayed separate rather than one answering for both.
    expect(await solanaRun.getAttribute('data-output')).toMatch(
      SOLANA_SIGNATURE,
    )
    await expect(page.getByTestId('sign-run-1')).toHaveAttribute(
      'data-status',
      'success',
    )

    await expectConnected(page, 'solana')
    await expectConnected(page, 'eip155')
  })
})
