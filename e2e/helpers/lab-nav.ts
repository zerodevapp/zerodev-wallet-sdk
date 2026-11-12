/** Navigation between the lab's feature areas, once a session is live. */

import { expect, type Page } from '@playwright/test'
import { LAB_TIMEOUT_MS } from './constants.js'

/**
 * Opens a Tx Signing area and waits for its cases to mount.
 *
 * The sidebar only exists once the kit reports a connection, so this has to
 * run after a connect rather than as a plain `goto`.
 * @param page The Playwright page.
 * @param area The area id, as declared in the lab's feature registry.
 */
export async function openTxSigningArea(
  page: Page,
  area: 'signing' | 'transactions' | 'contracts' | 'rpc' | 'session',
): Promise<void> {
  await page.getByTestId('nav-feature-tx-signing').click({
    timeout: LAB_TIMEOUT_MS,
  })
  if (area !== 'signing') {
    await page.getByTestId(`feature-tx-signing-tab-${area}`).click()
  }
  await expect(page.getByTestId(`area-${area}`)).toBeVisible({
    timeout: LAB_TIMEOUT_MS,
  })
}
