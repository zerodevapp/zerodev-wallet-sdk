/**
 * Drives the MetaMask extension's side of a dapp interaction.
 *
 * **Approvals are driven through `notification.html`**
 * MetaMask raises a request in a window of its own choosing, and what that
 * window shows is not dependable. Opening the notification
 * page directly renders the pending queue and redirects to the request, which
 * is the same thing a user sees and is reproducible.
 */

import { type BrowserContext, expect, type Page } from '@playwright/test'
import { extensionUrl } from './session.js'
import { unlockIfLocked } from './unlock.js'

/** Approvals wait on the service worker waking up, which is not quick. */
const APPROVAL_TIMEOUT_MS = 45_000

const REQUEST_SETTLE_TIMEOUT_MS = 10_000

/**
 * A pending signing request, on either route MetaMask uses for one.
 *
 * EVM personal-sign and typed data land on
 * `#/confirm-transaction/<id>/signature-request`; a Solana `signMessage` lands
 * on the redesigned `#/confirmation/<id>`. Which screen appears is the wallet's
 * own business, so matching only the first made every Solana signing case time
 * out on a prompt that was already open.
 */
const SIGNING_REQUEST = /signature-request|#\/confirmation\//

export class MetaMask {
  constructor(
    private readonly context: BrowserContext,
    private readonly extensionId: string,
    private readonly password: string,
  ) {}

  /** Approves a pending connection request and waits for it to be consumed. */
  async approveConnection(): Promise<void> {
    const page = await this.openPendingRequest()
    await expect(page).toHaveURL(/#\/connect\//, {
      timeout: APPROVAL_TIMEOUT_MS,
    })
    await this.confirm(page)
  }

  /**
   * Approves a pending signature request.
   *
   * @param showing Text the prompt must display before it is approved — the
   * payload, to prove the wallet was asked to sign what the app sent rather
   * than merely asked for something.
   */
  async approveSignature(showing?: string): Promise<void> {
    const page = await this.openPendingRequest()
    await expect(page).toHaveURL(SIGNING_REQUEST, {
      timeout: APPROVAL_TIMEOUT_MS,
    })
    if (showing !== undefined) {
      await expect(page.getByText(showing)).toBeVisible({
        timeout: APPROVAL_TIMEOUT_MS,
      })
    }
    await this.confirm(page)
  }

  /**
   * Rejects a pending signature request.
   */
  async rejectSignature(): Promise<void> {
    const page = await this.openPendingRequest()
    await expect(page).toHaveURL(SIGNING_REQUEST, {
      timeout: APPROVAL_TIMEOUT_MS,
    })
    await this.rejectButton(page).click({ timeout: APPROVAL_TIMEOUT_MS })
    if (!page.isClosed()) await page.close()
  }

  /**
   * Rejects a pending connection request.
   */
  async rejectPendingRequest(): Promise<void> {
    const page = await this.openPendingRequest()
    await expect(page).toHaveURL(/#\/connect\//, {
      timeout: APPROVAL_TIMEOUT_MS,
    })
    await this.rejectButton(page).click({ timeout: APPROVAL_TIMEOUT_MS })
    if (!page.isClosed()) await page.close()
  }

  /**
   * The approve button, whichever layout MetaMask uses for this request.
   *
   * The redesigned confirmation carries no test id, so it is reached by its
   * name. Where a layout has both, the two locators resolve to the same
   * element.
   */
  private approveButton(page: Page) {
    return page
      .getByTestId('confirm-btn')
      .or(page.getByTestId('confirm-footer-button'))
      .or(page.getByRole('button', { name: 'Confirm', exact: true }))
  }

  /** The reject button, across the same layouts. */
  private rejectButton(page: Page) {
    return page
      .getByTestId('cancel-btn')
      .or(page.getByTestId('confirm-footer-cancel-button'))
      .or(page.getByRole('button', { name: 'Cancel', exact: true }))
  }

  /**
   * Opens the notification page and gets it past the lock screen.
   */
  private async openPendingRequest(): Promise<Page> {
    const page = await this.context.newPage()
    await page.goto(`chrome-extension://${this.extensionId}/notification.html`)

    await unlockIfLocked(page, this.password)
    return page
  }

  /**
   * Clicks the approve button and waits for the window to be done with it.
   */
  private async confirm(page: Page): Promise<void> {
    const approve = this.approveButton(page)
    await approve.click({ timeout: APPROVAL_TIMEOUT_MS })

    await approve
      .waitFor({ state: 'hidden', timeout: REQUEST_SETTLE_TIMEOUT_MS })
      .catch(() => undefined)

    if (!page.isClosed()) await page.close()
  }

  /**
   * Asserts the wallet lists `origin` on its own connected-sites page.
   */
  async expectSiteConnected(origin: string): Promise<void> {
    await this.expectSiteRowCount(origin, 1)
  }

  async expectSiteNotConnected(origin: string): Promise<void> {
    await this.expectSiteRowCount(origin, 0)
  }

  /**
   * Counts the rows for `origin`, waiting for the list to render first.
   */
  private async expectSiteRowCount(
    origin: string,
    count: number,
  ): Promise<void> {
    const page = await this.openPermissions()
    const rows = page.getByTestId('connection-list-item')

    try {
      await expect(
        rows.first().or(page.getByText('Nothing to see here')),
      ).toBeVisible({ timeout: APPROVAL_TIMEOUT_MS })

      await expect(rows.filter({ hasText: origin })).toHaveCount(count)
    } finally {
      await page.close()
    }
  }

  /**
   * Revokes every site's permissions from the wallet's own UI.
   */
  async disconnectAllSites(): Promise<void> {
    const page = await this.openPermissions()

    await page
      .getByRole('button', { name: 'Disconnect all' })
      .click({ timeout: APPROVAL_TIMEOUT_MS })

    // The confirmation repeats the name, so this has to be scoped to the
    // dialog or the click resolves back to the button behind it.
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Disconnect all' })
      .click({ timeout: APPROVAL_TIMEOUT_MS })

    await expect(page.getByText('Nothing to see here')).toBeVisible({
      timeout: APPROVAL_TIMEOUT_MS,
    })
    await page.close()
  }

  /**
   * The connected-sites list.
   */
  private async openPermissions(): Promise<Page> {
    const page = await this.openWallet()
    await page.goto(extensionUrl(this.extensionId, '#/permissions'))
    return page
  }

  /** The wallet's own UI, unlocked. */
  async openWallet(): Promise<Page> {
    const page = await this.context.newPage()
    await page.goto(extensionUrl(this.extensionId))

    await unlockIfLocked(page, this.password)

    await expect(page.getByTestId('account-menu-icon')).toBeVisible({
      timeout: APPROVAL_TIMEOUT_MS,
    })
    return page
  }
}
