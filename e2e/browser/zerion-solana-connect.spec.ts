/**
 * Browser E2E for the Solana namespace through a real Zerion extension.
 *
 * The MetaMask equivalents are in `metamask-solana-connect.spec.ts` and the
 * cases are deliberately the same, because the point of running them twice is
 * what the two wallets do differently. Zerion diverges in two measured ways,
 * each marked at the case it belongs to.
 */

import { expect, type Page } from '@playwright/test'
import { test } from '../fixtures/zerion.js'
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
import { openWalletPreset } from '../helpers/ui-login.js'
import { connectThroughZerion } from '../helpers/zerion/connect.js'

/** How long a dropped namespace is given to come back before it is called gone. */
const SETTLE_MS = 2_000

/**
 * Starts watching for anything the page throws, and returns a read of it.
 *
 * **The rejection this file cares about does not reach `pageerror` or the
 * console**, so listening to those alone reports a clean run: Next's dev
 * client handles `unhandledrejection` first and forwards it to the server
 * log. Catching it means listening inside the page, which is what the init
 * script is for — and it has to be installed before the first navigation.
 */
async function watchErrors(page: Page): Promise<() => Promise<string[]>> {
  const fromEvents: string[] = []
  page.on('pageerror', (error) => fromEvents.push(String(error)))
  page.on('console', (message) => {
    if (message.type() === 'error') fromEvents.push(message.text())
  })

  await page.addInitScript(() => {
    const store: string[] = []
    ;(window as unknown as { __rejections: string[] }).__rejections = store
    window.addEventListener('unhandledrejection', (event) => {
      store.push(String(event.reason))
    })
  })

  return async () => [
    ...fromEvents,
    ...(await page.evaluate(
      () =>
        (window as unknown as { __rejections?: string[] }).__rejections ?? [],
    )),
  ]
}

test.describe('Solana through Zerion', () => {
  test.describe.configure({ timeout: 120_000 })

  test('an installed Solana wallet connects into its own slot', async ({
    page,
    zerion,
  }) => {
    await openWalletPreset(page, { solana: true })
    await connectThroughZerion(page, zerion, 'solana')

    const solana = connector(page, 'solana')
    await expect(solana).toHaveAttribute('data-address', BASE58_ADDRESS)
    await expect(solana).toHaveAttribute('data-wallet', 'Zerion')
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

  /**
   * TC-32. Marked failing against a live defect, not a broken test — when this
   * goes red the defect was fixed, and the marker comes off.
   *
   * The connect itself succeeds, which is why the case above passes and this
   * one has to exist separately: the base58 address reaches viem's EVM address
   * validator somewhere off the connect's own path, and surfaces as an
   * unhandled rejection rather than a rejected connect.
   */
  test.fail(
    'a Solana connect raises no EVM address validation error',
    async ({ page, zerion }) => {
      const readErrors = await watchErrors(page)

      await openWalletPreset(page, { solana: true })
      await connectThroughZerion(page, zerion, 'solana')

      const address = await addressOf(page, 'solana')
      const offending = (await readErrors()).filter((error) =>
        /InvalidAddressError/.test(error),
      )
      expect(
        offending,
        `the connected Solana address ${address} reached an EVM address validator`,
      ).toEqual([])
    },
  )

  /**
   * Marked failing against a live defect: **connecting a second namespace
   * disconnects the first**, in both directions. Measured against this wallet
   * only — MetaMask holds both through the identical harness path, so the
   * harness is not what differs. Whether the kit drops the first session or
   * Zerion replaces the site grant is not yet isolated.
   *
   * The next three cases are the same defect seen from three sides, which is
   * why they are marked rather than merged: each flips green on its own when
   * the fix lands.
   */
  test.fail(
    'Solana first, then EVM on the same wallet',
    async ({ page, zerion }) => {
      await openWalletPreset(page, { solana: true })
      await connectThroughZerion(page, zerion, 'solana')
      const solanaAddress = await addressOf(page, 'solana')

      // Zerion prompts again here. MetaMask does not: its EVM approval already
      // authorises the site for both sides, so the second connect resolves from
      // the existing grant.
      await connectThroughZerion(page, zerion, 'eip155')

      // The second connect must not drop the first.
      await expectConnected(page, 'solana')
      expect(await addressOf(page, 'solana')).toBe(solanaAddress)
      await expect(connector(page, 'eip155')).toHaveAttribute(
        'data-address',
        EVM_ADDRESS,
      )
    },
  )

  /** The other direction of the same defect. */
  test.fail(
    'EVM first, then Solana on the same wallet',
    async ({ page, zerion }) => {
      await openWalletPreset(page, { solana: true })
      await connectThroughZerion(page, zerion, 'eip155')
      const evmAddress = await addressOf(page, 'eip155')

      await connectThroughZerion(page, zerion, 'solana')

      // The EVM connection from step 1 is still the current one, not replaced.
      await expectConnected(page, 'eip155')
      expect(await addressOf(page, 'eip155')).toBe(evmAddress)
      await expect(connector(page, 'solana')).toHaveAttribute(
        'data-address',
        BASE58_ADDRESS,
      )
    },
  )

  test('a Solana connect does not light up the wallet EVM side', async ({
    page,
    zerion,
  }) => {
    await openWalletPreset(page, { solana: true })
    await connectThroughZerion(page, zerion, 'solana')

    await page.waitForTimeout(SETTLE_MS)
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

  /**
   * Blocked by the same defect, which it cannot get past: the reload this
   * case is actually about never runs, because the second connect has already
   * dropped the first.
   *
   * The two `expectConnected` calls below are what make that an assertion
   * rather than a throw. Without them `addressOf` raises on the empty
   * attribute, and a `test.fail()` marker that passes because its body threw
   * for any reason at all is not a marker, it is a blind spot.
   */
  test.fail(
    'both namespaces persist across a reload',
    async ({ page, zerion }) => {
      await openWalletPreset(page, { solana: true })
      await connectThroughZerion(page, zerion, 'solana')
      await connectThroughZerion(page, zerion, 'eip155')

      await expectConnected(page, 'solana')
      await expectConnected(page, 'eip155')

      const solanaAddress = await addressOf(page, 'solana')
      const evmAddress = await addressOf(page, 'eip155')

      await page.reload()

      await expectConnected(page, 'solana')
      await expectConnected(page, 'eip155')
      expect(await addressOf(page, 'solana')).toBe(solanaAddress)
      expect(await addressOf(page, 'eip155')).toBe(evmAddress)
    },
  )
})
