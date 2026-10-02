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
   */
  async approveSignature(): Promise<void> {
    const page = await this.openPendingRequest()
    await expect(page).toHaveURL(/signature-request/, {
      timeout: APPROVAL_TIMEOUT_MS,
    })
    await this.confirm(page)
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
   * The approve button, whichever of the two MetaMask uses for this request.
   */
  private approveButton(page: Page) {
    return page
      .getByTestId('confirm-btn')
      .or(page.getByTestId('confirm-footer-button'))
  }

  /** The reject button, across the same two confirmation layouts. */
  private rejectButton(page: Page) {
    return page
      .getByTestId('cancel-btn')
      .or(page.getByTestId('confirm-footer-cancel-button'))
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
    await this.approveButton(page).click({ timeout: APPROVAL_TIMEOUT_MS })

    await page
      .waitForEvent('close', { timeout: APPROVAL_TIMEOUT_MS })
      .catch(async () => {
        // Some flows leave the window open on a follow-up step instead of
        // closing it. Close it so the next request opens a clean one.
        if (!page.isClosed()) await page.close()
      })
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
