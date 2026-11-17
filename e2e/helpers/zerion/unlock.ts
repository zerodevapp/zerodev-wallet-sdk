/**
 * Getting a Zerion page past the lock screen.
 */

import type { Page } from '@playwright/test'

/** Long enough for the extension UI to boot on a cold service worker. */
const LOCK_SCREEN_TIMEOUT_MS = 20_000

/** How long the unlock gets to take effect. Measured at ~2s on a warm cache. */
const UNLOCK_TIMEOUT_MS = 30_000

/** Gap between re-navigations while waiting for the unlock to land. */
const UNLOCK_POLL_MS = 1_000

/**
 * Unlocks `page` if it is showing the lock screen, and does nothing if not.
 */
export async function unlockIfLocked(
  page: Page,
  password: string,
): Promise<void> {
  const passwordField = page.getByPlaceholder('Password')

  const visible = async (): Promise<boolean> =>
    passwordField
      .waitFor({ state: 'visible', timeout: LOCK_SCREEN_TIMEOUT_MS })
      .then(() => true)
      .catch(() => false)

  if (!(await visible())) {
    // Either already unlocked, or the view is still booting. A reload is the
    // right move here — unlike after the click, there is no hash to escape.
    await page.reload()
    if (!(await visible())) return
  }

  await passwordField.fill(password)
  await page.getByRole('button', { name: /Unlock/i }).click()

  // Navigating the instant the click returns cancels the login request that is
  // still in flight, and the root route then redirects straight back to
  // `#/login` — which reads exactly like a rejected password. So re-navigate on
  // a short interval until the root stops redirecting, and fail loudly if it
  // never does rather than handing the caller a still-locked page.
  const base = page.url().split('#')[0]
  const deadline = Date.now() + UNLOCK_TIMEOUT_MS

  while (Date.now() < deadline) {
    await page.waitForTimeout(UNLOCK_POLL_MS)
    await page.goto(`${base}#/`)
    if (!page.url().includes('/login')) return

    const rejected = await page
      .getByText(/Incorrect password/i)
      .isVisible()
      .catch(() => false)
    if (rejected) {
      throw new Error(
        'Zerion rejected the password in wallet-credentials.ts. The cached ' +
          'profile was onboarded with different credentials, or TEST_WALLET ' +
          'changed without the profile being rebuilt.',
      )
    }
  }

  throw new Error(
    `Zerion stayed on the lock screen for ${UNLOCK_TIMEOUT_MS}ms after a ` +
      'password that it did not reject. The unlock request may not be ' +
      'completing — check the background service worker console.',
  )
}
