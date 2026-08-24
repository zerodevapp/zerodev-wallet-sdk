/**
 * Browser E2E for the SRA deposit widget, driven entirely by mocked backend
 * responses — no live SRA server, no bridge quotes, no funds.
 *
 * The widget's lifecycle is one polled method answering differently over time,
 * so the spec advances the mock between assertions rather than waiting on a
 * real deposit.
 */

import { expect, type Locator, type Page } from '@playwright/test'
import { test } from '../fixtures/authed-session.js'
import { ping } from '../helpers/temp-email.js'
import {
  providerFees,
  RELAY_FEES_USD,
  RELAY_PROVIDER_NAME,
} from '../mocks/definitions/providerFees.js'
import {
  buildPastDeposits,
  createSraMocks,
  SRA_MOCK_ADDRESS,
  type SraMockHandle,
} from '../mocks/definitions/sra.js'
import { routeMocks } from '../mocks/routeMocks.js'

/**
 * The widget polls every 5s and the interval is not configurable, so every
 * assertion after an `advance()` has to tolerate one whole interval of the
 * previous stage still being on screen. Playwright retries, so this is a
 * timeout rather than a sleep.
 */
const POLL_WINDOW_MS = 20_000

/** Minimums the default routes quote, per symbol. */
const MIN_DEPOSIT = { USDC: '1.25', USDT: '0.52' } as const

const widgetOf = (page: Page) => page.getByTestId('sra-deposit-panel')

const card = (page: Page, title: string) =>
  widgetOf(page).getByText(title, { exact: true }).locator('../..')

/** Installs the mocks, then navigates to the SRA feature. */
async function openSra(page: Page, sra: SraMockHandle) {
  // Two installs rather than one array: the returned handle then counts SRA
  // traffic only. The bridge quotes are served by the earlier registration,
  // which the SRA install falls through to.
  await routeMocks(page, providerFees)
  const mocked = await routeMocks(page, sra.mocks)
  // Client-side nav — a full load drops the wallet into a reconnect, and the
  // widget renders nothing without a connected account.
  await page.getByTestId('nav-feature-sra').click()
  await expect(page.getByTestId('sra-surface')).toBeVisible()
  return mocked
}

/**
 * The first status response is the baseline: the widget treats everything in
 * it as already-past, so a deposit advanced before it lands never renders as
 * new.
 */
async function waitForFirstPoll(sra: SraMockHandle) {
  await expect
    .poll(() => sra.calls().status, { timeout: POLL_WINDOW_MS })
    .toBeGreaterThan(0)
}

async function switchToken({
  page,
  send,
  from,
  to,
}: {
  page: Page
  send: Locator
  from: string
  to: string
}) {
  await send.getByRole('button', { name: from }).click()
  await page.getByRole('option', { name: new RegExp(`^${to}`) }).click()
}

test.describe('SRA deposits', () => {
  test.beforeEach(async () => {
    try {
      await ping()
    } catch {
      test.skip(true, 'Email service unavailable')
    }
  })

  test('drives one deposit from detected through routing to received', async ({
    authedPage: page,
  }) => {
    const sra = createSraMocks()
    const mocked = await openSra(page, sra)
    const widget = widgetOf(page)

    await expect(widget.getByTestId('address-display-address')).toHaveText(
      SRA_MOCK_ADDRESS,
      { timeout: POLL_WINDOW_MS },
    )
    expect(sra.calls().create).toBeGreaterThan(0)

    await waitForFirstPoll(sra)
    const pending = widget.getByRole('region', { name: 'Active deposits' })

    sra.advance('pending')
    await expect(pending.getByText('Detected', { exact: true })).toBeVisible({
      timeout: POLL_WINDOW_MS,
    })

    sra.advance()
    await expect(pending.getByText('Routing', { exact: true })).toBeVisible({
      timeout: POLL_WINDOW_MS,
    })

    sra.advance()
    await expect(pending.getByText('Delivered', { exact: true })).toBeVisible({
      timeout: POLL_WINDOW_MS,
    })

    await expect(pending.getByRole('listitem')).toHaveCount(1)
    expect(mocked.hits()).toBe(sra.calls().create + sra.calls().status)
  })

  test('shows a deposit that fails after bridging as Failed', async ({
    authedPage: page,
  }) => {
    const sra = createSraMocks()
    await openSra(page, sra)
    const widget = widgetOf(page)
    await waitForFirstPoll(sra)

    const pending = widget.getByRole('region', { name: 'Active deposits' })

    sra.advance('bridging')
    await expect(pending.getByText('Routing', { exact: true })).toBeVisible({
      timeout: POLL_WINDOW_MS,
    })

    sra.fail()
    await expect(pending.getByText('Failed', { exact: true })).toBeVisible({
      timeout: POLL_WINDOW_MS,
    })
  })

  test('arrives as whichever token is selected to send', async ({
    authedPage: page,
  }) => {
    const sra = createSraMocks()
    await openSra(page, sra)
    const widget = widgetOf(page)
    const send = card(page, 'Send')
    const arrivesAs = card(page, 'Arrives as')

    const expectQuotedIn = async (symbol: keyof typeof MIN_DEPOSIT) => {
      await expect(send.getByText(symbol, { exact: true })).toBeVisible({
        timeout: POLL_WINDOW_MS,
      })
      await expect(arrivesAs.getByText(symbol, { exact: true })).toBeVisible()
      await expect(
        arrivesAs.getByText('Arbitrum One', { exact: true }),
      ).toBeVisible()

      await expect(
        widget.getByText(`${MIN_DEPOSIT[symbol]} ${symbol}`, { exact: true }),
      ).toBeVisible()
    }

    await expectQuotedIn('USDC')
    await switchToken({ page, send, from: 'USDC', to: 'USDT' })
    await expectQuotedIn('USDT')
    // Back again, so the first result can't have been a fluke of load order.
    await switchToken({ page, send, from: 'USDT', to: 'USDC' })
    await expectQuotedIn('USDC')
  })

  test('offers every network the token claims to support', async ({
    authedPage: page,
  }) => {
    const sra = createSraMocks()
    await openSra(page, sra)
    const send = card(page, 'Send')
    await expect(send.getByText('USDC', { exact: true })).toBeVisible({
      timeout: POLL_WINDOW_MS,
    })

    await send.getByRole('button', { name: 'USDC' }).click()
    const option = page.getByRole('option', { name: /^USDT/ })
    const claimed = Number(
      /(\d+)\s*networks?/.exec((await option.textContent()) ?? '')?.[1],
    )
    expect(claimed).toBeGreaterThan(1)
    await option.click()

    await send.getByRole('button').nth(1).click()
    await expect(page.getByRole('option')).toHaveCount(claimed)
  })

  test('shows the create-failure card and recovers on retry', async ({
    authedPage: page,
  }) => {
    const sra = createSraMocks({ errorMode: 'address-create-failed' })
    await openSra(page, sra)
    const widget = widgetOf(page)

    await expect(widget.getByRole('alert')).toContainText(
      'Failed to create deposit address...',
      { timeout: POLL_WINDOW_MS },
    )

    sra.setErrorMode('none')
    await widget.getByRole('button', { name: 'Retry' }).click()

    await expect(widget.getByTestId('address-display-address')).toHaveText(
      SRA_MOCK_ADDRESS,
      { timeout: POLL_WINDOW_MS },
    )
    await expect(widget.getByRole('alert')).toHaveCount(0)
    expect(sra.calls().create).toBeGreaterThan(1)
  })

  test('shows the no-routes card when creation returns no estimates', async ({
    authedPage: page,
  }) => {
    const sra = createSraMocks({ errorMode: 'route-not-found' })
    await openSra(page, sra)
    const widget = widgetOf(page)

    await expect(widget.getByRole('alert')).toContainText(
      'No routes found, try one more time...',
      { timeout: POLL_WINDOW_MS },
    )

    await expect(widget.getByTestId('address-display-address')).toHaveText(
      SRA_MOCK_ADDRESS,
    )
  })

  test('shows the polling-failure card only once a poll has succeeded', async ({
    authedPage: page,
  }) => {
    const sra = createSraMocks()
    await openSra(page, sra)
    const widget = widgetOf(page)

    await waitForFirstPoll(sra)
    await expect(widget.getByRole('alert')).toHaveCount(0)

    sra.setErrorMode('polling-failed')
    await expect(widget.getByRole('alert')).toContainText(
      'Failed to load deposits, try again...',
      { timeout: POLL_WINDOW_MS },
    )

    sra.setErrorMode('none')
    await expect(widget.getByRole('alert')).toHaveCount(0, {
      timeout: POLL_WINDOW_MS,
    })
  })

  test('opens a past deposit and shows the route it was made on', async ({
    authedPage: page,
  }) => {
    const sra = createSraMocks({ pastDeposits: buildPastDeposits(0, 3) })
    await openSra(page, sra)
    const widget = widgetOf(page)

    await widget.getByText(/^Past deposits \(3\)$/).click()
    await widget.getByRole('listitem').first().click()

    await expect(widget.getByText('From network')).toBeVisible()
    // Everything below is what the mock reported for the default route:
    // 250 USDC sent on OP Mainnet, settling on Arbitrum less the 0.15 fee.
    // The "From" row renders the amount and symbol as separate nodes around
    // the token logo, so they're asserted individually.
    await expect(widget.getByText('250', { exact: true })).toBeVisible()
    await expect(widget.getByText('USDC', { exact: true })).toBeVisible()
    await expect(widget.getByText('249.85 USDC', { exact: true })).toBeVisible()
    await expect(widget.getByText('OP Mainnet', { exact: true })).toBeVisible()
    await expect(
      widget.getByText('Arbitrum One', { exact: true }),
    ).toBeVisible()

    await widget.getByRole('button', { name: 'Show fee details' }).click()
    const panel = widget.getByRole('region', { name: 'Fee breakdown' })
    await expect(panel.getByText('Provider', { exact: true })).toBeVisible()
    await expect(
      panel.getByText(RELAY_PROVIDER_NAME, { exact: true }),
    ).toBeVisible()
  })

  test('breaks the quote down into its provider legs', async ({
    authedPage: page,
  }) => {
    const sra = createSraMocks()
    await openSra(page, sra)
    const send = card(page, 'Send')
    await expect(send.getByText('USDC', { exact: true })).toBeVisible({
      timeout: POLL_WINDOW_MS,
    })

    await send.getByRole('button', { name: 'Show fee details' }).click()

    await expect(send.getByText('Provider', { exact: true })).toBeVisible()
    await expect(
      send.getByText(RELAY_PROVIDER_NAME, { exact: true }),
    ).toBeVisible()

    for (const label of [
      'Execution Fee',
      'Service Fee',
      'Destination Gas',
      'Origin Gas',
    ]) {
      await expect(send.getByText(label, { exact: true })).toBeVisible()
    }

    await expect(send.getByText('$0.15', { exact: true })).toBeVisible()
    await expect(
      send.getByText(`$${RELAY_FEES_USD.service}`, { exact: true }),
    ).toBeVisible()
    await expect(
      send.getByText(`$${RELAY_FEES_USD.destinationGas}`, { exact: true }),
    ).toBeVisible()
    await expect(
      send.getByText(`$${RELAY_FEES_USD.originGas}`, { exact: true }),
    ).toBeVisible()
  })
})
