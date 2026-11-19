/**
 * Connects the lab to Zerion, driving both halves: the sheet in the page and
 * the approval in the extension.
 */

import { expect, type Page } from '@playwright/test'
import { expectConnected, type Namespace } from '../connector-bar.js'
import { LAB_TIMEOUT_MS } from '../constants.js'
import {
  expectSignUpSheet,
  openSignIn,
  pickChain,
  type SignInNamespace,
} from '../ui-login.js'
import type { Zerion } from './zerion.js'

/** How long the row is given before the lab is reloaded to re-ask. */
const ANNOUNCE_GRACE_MS = 5_000

/** The row, however the sheet is reached. */
export const zerionRow = (page: Page) =>
  page.getByRole('button', { name: /^Zerion/ })

/**
 * Opens the sign-in sheet with Zerion announced.
 *
 * The reload is a workaround, not a verdict on whose bug it is: whether Zerion
 * announces only on request or wagmi drops a late announcement is unresolved.
 */
export async function openZerionSheet(
  page: Page,
  namespace: SignInNamespace = 'eip155',
): Promise<void> {
  await openSignIn(page, namespace)
  await expectSignUpSheet(page)

  const announced = await zerionRow(page)
    .waitFor({ state: 'visible', timeout: ANNOUNCE_GRACE_MS })
    .then(() => true)
    .catch(() => false)
  if (announced) return

  await page.reload()
  await openSignIn(page, namespace)
  await expectSignUpSheet(page)
  await expect(zerionRow(page)).toBeVisible({ timeout: LAB_TIMEOUT_MS })
}

export async function connectThroughZerion(
  page: Page,
  zerion: Zerion,
  namespace: Namespace,
  /**
   * Whether Zerion is expected to prompt. False only where the wallet has
   * already authorised the namespace, in which case there is no request to
   * answer and reaching `connected` is itself the assertion.
   */
  prompts = true,
): Promise<void> {
  await openZerionSheet(page, namespace)
  await pickChain(page, 'Zerion', namespace)

  if (prompts) await zerion.approveConnection()
  await expectConnected(page, namespace)
}
