/**
 * Getting a MetaMask page past the lock screen.
 */

import type { Page } from '@playwright/test'

/** Long enough for the extension UI to boot on a cold service worker. */
const LOCK_SCREEN_TIMEOUT_MS = 15_000

/**
 * Unlocks `page` if it is showing the lock screen, and does nothing if not.
 */
export async function unlockIfLocked(
  page: Page,
  password: string,
): Promise<void> {
  const passwordField = page.getByTestId('unlock-password')

  const unlocked = page
    .getByTestId('confirm-footer-button')
    .or(page.getByTestId('confirm-btn'))
    .or(page.getByTestId('account-menu-icon'))

  await passwordField
    .or(unlocked)
    .first()
    .waitFor({ state: 'visible', timeout: LOCK_SCREEN_TIMEOUT_MS })
    .catch(() => undefined)

  if (!(await passwordField.isVisible())) return

  await passwordField.fill(password)
  await page.getByTestId('unlock-submit').click()
}
