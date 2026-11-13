/**
 * Walks Zerion's import-an-existing-wallet onboarding.
 *
 * Every selector here is a Zerion internal that can move on any release, so a
 * version bump is expected to break this and nothing else. The profile cache is
 * what keeps that cost to once per version rather than once per test.
 */

import { expect, type Page } from '@playwright/test'
import type { WalletCredentials } from '../wallet-credentials.js'

/** Deriving the vault and scanning for accounts are the slow steps. */
const STEP_TIMEOUT_MS = 60_000

/** How long an optional screen gets to render before it is treated as absent. */
const OPTIONAL_SCREEN_TIMEOUT_MS = 10_000

const SEED_WORDS = 12

async function appears(
  locator: ReturnType<Page['getByRole']>,
  timeout = OPTIONAL_SCREEN_TIMEOUT_MS,
): Promise<boolean> {
  return locator
    .waitFor({ state: 'visible', timeout })
    .then(() => true)
    .catch(() => false)
}

/**
 * Drives onboarding to a usable wallet on `page`, which must already be on the
 * extension's onboarding route.
 */
export async function onboardWithRecoveryPhrase(
  page: Page,
  { secretRecoveryPhrase, password }: WalletCredentials,
): Promise<void> {
  const words = secretRecoveryPhrase.trim().split(/\s+/)
  if (words.length !== SEED_WORDS) {
    throw new Error(
      `Zerion's import form has ${SEED_WORDS} word inputs, but the test ` +
        `phrase has ${words.length} words.`,
    )
  }

  const t = { timeout: STEP_TIMEOUT_MS }

  await page.getByRole('link', { name: /Import Existing Wallet/i }).click(t)
  await page.getByRole('link', { name: /Import Recovery Phrase/i }).click(t)

  // Addressed by id rather than by role: the inputs carry no accessible name
  // that distinguishes word 3 from word 9, and Zerion's own helper uses these.
  for (const [index, word] of words.entries()) {
    await page.locator(`#word-${index}`).fill(word, t)
  }
  await page.getByRole('button', { name: /Import Wallet/i }).click(t)
  await page.getByRole('button', { name: /Continue/i }).click(t)

  await setPassword(page, password)

  await expect(
    page.getByText(/Nicely Done/i),
    'onboarding never reached its success screen — Zerion likely changed a step',
  ).toBeVisible({ timeout: STEP_TIMEOUT_MS })
}

/**
 * Sets the vault password across Zerion's two-step password screen.
 */
async function setPassword(page: Page, password: string): Promise<void> {
  const t = { timeout: STEP_TIMEOUT_MS }

  await page.getByPlaceholder(/at least 6 characters/i).fill(password, t)
  await page.getByRole('button', { name: /Confirm Password/i }).click(t)

  const proceedAnyway = page.getByRole('link', { name: /Proceed Anyway/i })
  if (await appears(proceedAnyway)) await proceedAnyway.click(t)

  await page.getByPlaceholder(/re-enter password/i).fill(password, t)
  await page.getByRole('button', { name: /Set Password/i }).click(t)
}
