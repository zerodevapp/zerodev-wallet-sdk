/**
 * The config builder's namespace output.
 *
 * `namespaces` and the Solana flag are independent axes in the lab, so a URL
 * naming Solana rows without the flag has to survive a round trip through
 * the builder, and the flag's toggle has to move between the two defaults
 * without touching an explicit choice.
 */

import { expect, type Page, test } from '@playwright/test'

const generatedUrl = (page: Page) => page.getByTestId('config-generated-url')

test.describe('config builder namespaces', () => {
  test('keeps Solana rows named without the flag', async ({ page }) => {
    await page.goto('/config?preset=preset-2&ns=eip155,solana')

    await expect(page.getByTestId('config-namespaces')).toHaveAttribute(
      'data-value',
      'eip155,solana',
    )
    await expect(generatedUrl(page)).toContainText('ns=eip155%2Csolana')
    await expect(generatedUrl(page)).not.toContainText('solana=true')
    await expect(page.getByTestId('config-namespaces-warning')).toBeVisible()
  })

  test('the flag toggles between the two defaults', async ({ page }) => {
    await page.goto('/config')
    await expect(generatedUrl(page)).not.toContainText('ns=')

    await page.getByTestId('config-solana-input').check()
    await expect(page.getByTestId('config-namespaces')).toHaveAttribute(
      'data-mode',
      'all',
    )
    await expect(generatedUrl(page)).toContainText('solana=true')
    await expect(generatedUrl(page)).not.toContainText('ns=')

    await page.getByTestId('config-solana-input').uncheck()
    await expect(page.getByTestId('config-namespaces')).toHaveAttribute(
      'data-mode',
      'eip155',
    )
    await expect(generatedUrl(page)).not.toContainText('ns=')
    await expect(generatedUrl(page)).not.toContainText('solana=true')
  })

  test('an explicit choice survives the flag', async ({ page }) => {
    await page.goto('/config?solana=true&ns=solana')
    await expect(page.getByTestId('config-namespaces')).toHaveAttribute(
      'data-mode',
      'solana',
    )

    await page.getByTestId('config-solana-input').uncheck()
    await expect(page.getByTestId('config-namespaces')).toHaveAttribute(
      'data-mode',
      'solana',
    )
    await expect(generatedUrl(page)).toContainText('ns=solana')
    await expect(page.getByTestId('config-namespaces-warning')).toBeVisible()
  })
})
