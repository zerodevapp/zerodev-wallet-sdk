/**
 * Drives the Zerion extension's side of a dapp interaction.
 *
 * **Approvals are caught, not opened — this is the one structural difference
 * from the MetaMask driver.** MetaMask raises a request in a window of its own
 * choosing, but its `notification.html` renders the pending queue on demand, so
 * that driver opens the request itself and is immune to timing. Zerion has no
 * such route: navigating to `ui/popup.html` or `#/requestAccounts` directly
 * returns an empty body and the page closes itself. The request exists only as
 * the page Zerion opened, so it has to be taken from the context.
 *
 * That page is an ordinary page in the same browser context rather than an OS
 * window, which is what makes it reachable at all. It carries
 * `windowType=dialog`, and the route names the request
 * (`#/requestAccounts`, `#/signMessage`, ...) with `ecosystem=evm|solana` for
 * the namespace.
 *
 * `windowType=dialog` is the discriminator and it is load-bearing: Zerion also
 * opens an onboarding tab of its own, carrying
 * `windowType=tab&appMode=onboarding`. A predicate that merely looks for a page
 * on the extension's origin matches that tab instead, intermittently, and reads
 * the welcome screen while the real dialog waits.
 */

import { type BrowserContext, expect, type Page } from '@playwright/test'
import { extensionUrl } from './session.js'
import { unlockIfLocked } from './unlock.js'

/** Approvals wait on the service worker waking up, which is not quick. */
const APPROVAL_TIMEOUT_MS = 45_000

const REQUEST_SETTLE_TIMEOUT_MS = 10_000

const isDialog = (page: Page) => page.url().includes('windowType=dialog')

export class Zerion {
  constructor(
    private readonly context: BrowserContext,
    private readonly extensionId: string,
    private readonly password: string,
  ) {}

  /** Approves a pending connection request and waits for it to be consumed. */
  async approveConnection(): Promise<void> {
    const page = await this.pendingDialog()
    await expect(page).toHaveURL(/#\/requestAccounts/, {
      timeout: APPROVAL_TIMEOUT_MS,
    })
    await this.settle(page, this.approveButton(page))
  }

  /** Rejects a pending connection request. */
  async rejectPendingRequest(): Promise<void> {
    const page = await this.pendingDialog()
    await expect(page).toHaveURL(/#\/requestAccounts/, {
      timeout: APPROVAL_TIMEOUT_MS,
    })
    await this.settle(page, this.rejectButton(page))
  }

  /**
   * Approves a pending signature request.
   *
   * @param showing Text the prompt must display before it is approved — the
   * payload, to prove the wallet was asked to sign what the app sent rather
   * than merely asked for something.
   */
  async approveSignature(showing?: string): Promise<void> {
    const page = await this.pendingDialog()
    if (showing !== undefined) {
      await expect(page.getByText(showing)).toBeVisible({
        timeout: APPROVAL_TIMEOUT_MS,
      })
    }
    await this.settle(page, this.signButton(page))
  }

  /** Rejects a pending signature request. */
  async rejectSignature(): Promise<void> {
    const page = await this.pendingDialog()
    await this.settle(page, this.rejectButton(page))
  }

  /**
   * The buttons, by accessible name.
   *
   * Taken from Zerion's own `e2e/fixtures/pages/dapp/approval-window.ts`, which
   * is the maintained reference for these — the built bundle carries no test
   * ids of any convention.
   */
  private approveButton(page: Page) {
    return page.getByRole('button', { name: /^Connect$/i })
  }

  private signButton(page: Page) {
    return page.getByRole('button', { name: /^Sign$/i })
  }

  private rejectButton(page: Page) {
    return page.getByRole('button', { name: /^Cancel$/i })
  }

  /**
   * The dialog Zerion opened for the pending request.
   *
   * Checks the pages that already exist before waiting for a new one, because
   * the caller reaches this *after* the click that triggered the request — so
   * the dialog has usually opened already and waiting alone would hang until
   * the timeout. Waiting alone is still needed for the other order, where the
   * request is raised by something slower than the click.
   */
  private async pendingDialog(): Promise<Page> {
    const existing = this.context.pages().find(isDialog)
    const page =
      existing ??
      (await this.context.waitForEvent('page', {
        predicate: isDialog,
        timeout: APPROVAL_TIMEOUT_MS,
      }))

    await page.waitForLoadState('domcontentloaded').catch(() => undefined)
    await this.assertRequestShowing(page)
    return page
  }

  /**
   * Fails loudly if the dialog came up behind the lock screen.
   *
   * **A locked dialog cannot be recovered, which is why `unlock()` runs
   * first.** Zerion keeps the request's own route in the hash and renders the
   * lock screen over it, so the URL reports a request that is not there;
   * unlocking inside the dialog is accepted but never re-renders it; and
   * re-navigating to the dialog's URL comes back locked again. Measured, all
   * three. So the only honest move here is to say what was seen.
   */
  private async assertRequestShowing(page: Page): Promise<void> {
    // Every request dialog carries Cancel, and the lock screen carries no
    // button but Unlock — so these two are what tell the states apart.
    const cancel = this.rejectButton(page)
    const locked = page.getByPlaceholder('Password')

    await expect(cancel.or(locked).first()).toBeVisible({
      timeout: APPROVAL_TIMEOUT_MS,
    })
    if (await locked.isVisible()) {
      throw new Error(
        'Zerion raised the request behind its lock screen. The wallet was ' +
          'unlocked before the request, so it re-locked in between — the ' +
          'dialog cannot be unlocked in place.',
      )
    }
  }

  /**
   * Gets the wallet past its lock screen, so a request raised afterwards
   * opens straight onto the request rather than behind the lock screen.
   */
  async unlock(): Promise<void> {
    const page = await this.context.newPage()
    try {
      await page.goto(extensionUrl(this.extensionId))
      await unlockIfLocked(page, this.password)
    } finally {
      if (!page.isClosed()) await page.close()
    }
  }

  /**
   * Clicks a decision and waits for the dialog to be done with it.
   *
   * Zerion closes the dialog itself once the request is answered, so a close is
   * the success signal rather than something to force.
   */
  private async settle(
    page: Page,
    button: ReturnType<Page['getByRole']>,
  ): Promise<void> {
    await button.click({ timeout: APPROVAL_TIMEOUT_MS })
    await page
      .waitForEvent('close', { timeout: REQUEST_SETTLE_TIMEOUT_MS })
      .catch(() => undefined)
    if (!page.isClosed()) await page.close()
  }

  /** The wallet's own UI, unlocked. */
  async openWallet(): Promise<Page> {
    const page = await this.context.newPage()
    await page.goto(extensionUrl(this.extensionId))
    await unlockIfLocked(page, this.password)
    await expect(
      page.getByRole('button', { name: /Copy Address/i }),
    ).toBeVisible({ timeout: APPROVAL_TIMEOUT_MS })
    return page
  }
}
