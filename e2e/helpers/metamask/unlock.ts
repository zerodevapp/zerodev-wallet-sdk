/**
 * Getting a MetaMask page past the lock screen.
 */

import { expect, type Page } from '@playwright/test'

/**
 * Long enough for the extension UI to boot on a cold service worker.
 *
 * Matches the approval budget in `metamask.ts`. A freshly onboarded profile
 * boots slower than a restored one, so a shorter budget here fails only when
 * the fixture cache is cold — which is to say, rarely and unreproducibly.
 */
const LOCK_SCREEN_TIMEOUT_MS = 45_000

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

  await expect(
    passwordField.or(unlocked).first(),
    'the MetaMask UI never rendered, so it could not be checked for the lock screen',
  ).toBeVisible({ timeout: LOCK_SCREEN_TIMEOUT_MS })

  if (!(await passwordField.isVisible())) return

  await passwordField.fill(password)
  await page.getByTestId('unlock-submit').click()
}
