/**
 * Reads the QA lab's connector bar, which carries one row per namespace.
 */

import { expect, type Page } from '@playwright/test'
import { LAB_TIMEOUT_MS } from './constants.js'

export type Namespace = 'eip155' | 'solana'

export function connector(page: Page, namespace: Namespace) {
  return page.getByTestId(`connector-${namespace}`)
}

export async function expectConnected(
  page: Page,
  namespace: Namespace,
): Promise<void> {
  await expect(connector(page, namespace)).toHaveAttribute(
    'data-status',
    'connected',
    { timeout: LAB_TIMEOUT_MS },
  )
}

export async function expectDisconnected(
  page: Page,
  namespace: Namespace,
): Promise<void> {
  const row = connector(page, namespace)
  await expect(row).toHaveAttribute('data-status', 'disconnected', {
    timeout: LAB_TIMEOUT_MS,
  })
  await expect(row).toHaveAttribute('data-address', '')
}

/** The address the kit reports for a namespace, read from the bar. */
export async function addressOf(
  page: Page,
  namespace: Namespace,
): Promise<string> {
  const address = await connector(page, namespace).getAttribute('data-address')
  if (!address) throw new Error(`${namespace} reports no address`)
  return address
}

/** Opens the logout dialog, which only appears when a choice is possible. */
export async function openDisconnectDialog(page: Page) {
  await page.getByTestId('wallet-logout').click()

  const dialog = page.getByTestId('disconnect-dialog')
  await expect(dialog).toBeVisible({ timeout: LAB_TIMEOUT_MS })
  return dialog
}
