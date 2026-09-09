/**
 * Walks MetaMask's import-an-existing-wallet onboarding.
 *
 * Every selector here is a MetaMask internal that can move on any
 * release, so a version bump is expected to break this and nothing else. The
 * profile cache is what keeps that cost to once per version rather than once
 * per test.
 *
 * Onboarding MetaMask can also trigger a few optional screens, such as
 * telemetry prompts or passkey suggestions, which need to be handled gracefully.
 */

import { expect, type Page } from '@playwright/test'
import type { WalletCredentials } from '../wallet-credentials.js'
import { unlockIfLocked } from './unlock.js'

/** MetaMask decrypting the vault and rendering the wallet is the slow step. */
const STEP_TIMEOUT_MS = 60_000

/**
 * Drives onboarding to a usable wallet on `page`, which must already be on the
 * extension's onboarding route.
 */
export async function onboardWithRecoveryPhrase(
  page: Page,
  { secretRecoveryPhrase, password }: WalletCredentials,
): Promise<void> {
  const step = (testId: string) => page.getByTestId(testId)

  await step('onboarding-import-wallet').click({ timeout: STEP_TIMEOUT_MS })
  await step('onboarding-import-with-srp-button').click()

  const phraseField = step('srp-input-import__srp-note')
  await phraseField.click()
  await phraseField.pressSequentially(secretRecoveryPhrase, { delay: 8 })

  await expect(page.getByTestId('import-srp__srp-word-11')).toBeVisible()
  await step('import-srp-confirm').click()

  await step('create-password-new-input').fill(password)
  await step('create-password-confirm-input').fill(password)
  await page.locator('#create-password-terms').check()
  await step('create-password-submit').click()

  await skipIfPresent(page, 'passkey-maybe-later-button')
  await optOutOfMetrics(page)
  await skipIfPresent(page, 'onboarding-complete-done')

  // Land on the wallet directly rather than following "Open wallet".
  await page.goto(`${page.url().split('#')[0]}#/`)

  await unlockIfLocked(page, password)
  await expect(page.getByTestId('account-menu-icon')).toBeVisible({
    timeout: STEP_TIMEOUT_MS,
  })
}

/**
 * How long an optional screen gets to render before it is treated as absent.
 */
const OPTIONAL_SCREEN_TIMEOUT_MS = 15_000

/**
 * True once `locator` is visible, false if it never shows up.
 */
async function appears(
  locator: ReturnType<Page['getByTestId']>,
  timeout = OPTIONAL_SCREEN_TIMEOUT_MS,
): Promise<boolean> {
  return locator
    .waitFor({ state: 'visible', timeout })
    .then(() => true)
    .catch(() => false)
}

/** Clicks a screen's dismiss button if that screen rendered at all. */
async function skipIfPresent(page: Page, testId: string): Promise<void> {
  const button = page.getByTestId(testId)
  if (await appears(button)) await button.click()
}

/**
 * Declines telemetry before continuing past the metrics screen.
 */
async function optOutOfMetrics(page: Page): Promise<void> {
  const proceed = page.getByTestId('metametrics-i-agree')
  if (!(await appears(proceed))) return

  for (const id of [
    '#metametrics-opt-in',
    '#metametrics-datacollection-opt-in',
  ]) {
    const box = page.locator(id)

    if (await box.isChecked().catch(() => false)) {
      await box.uncheck({ force: true }).catch(() => {})
    }
  }
  await proceed.click()
}
