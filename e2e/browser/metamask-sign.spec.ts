/**
 * Browser E2E for signing through a connected MetaMask extension.
 */

import { expect } from '@playwright/test'
import { test } from '../fixtures/metamask.js'
import {
  expectSignRunRejected,
  expectSignRunSucceeded,
} from '../helpers/tx-runs.js'

const LAB_TIMEOUT_MS = 90_000

test.describe('Preset 2 — real MetaMask signing', () => {
  test.describe.configure({ timeout: 300_000 })

  test('signs a message with the connected external wallet', async ({
    page,
    metamask,
  }) => {
    await page.goto('/?preset=preset-2')
    await expect(page.getByText('Continue to your wallet')).toBeVisible({
      timeout: LAB_TIMEOUT_MS,
    })
    await page.getByRole('button', { name: /^MetaMask/ }).click()
    await metamask.approveConnection()
    await expect(page.getByTestId('wallet-address')).toBeVisible({
      timeout: LAB_TIMEOUT_MS,
    })

    await page.getByTestId('nav-feature-tx-signing').click()
    await expect(page.getByTestId('area-signing')).toBeVisible()

    await page
      .getByTestId('case-sign-message-presets')
      .getByTestId('sign-message-submit')
      .click()

    await metamask.approveSignature()

    await expectSignRunSucceeded(page.getByTestId('sign-run-1'))
  })

  test('rejecting the signature reports the rejection on the sign run', async ({
    page,
    metamask,
  }) => {
    await page.goto('/?preset=preset-2')
    await expect(page.getByText('Continue to your wallet')).toBeVisible({
      timeout: LAB_TIMEOUT_MS,
    })
    await page.getByRole('button', { name: /^MetaMask/ }).click()
    await metamask.approveConnection()
    await expect(page.getByTestId('wallet-address')).toBeVisible({
      timeout: LAB_TIMEOUT_MS,
    })

    await page.getByTestId('nav-feature-tx-signing').click()
    await expect(page.getByTestId('area-signing')).toBeVisible()

    await page
      .getByTestId('case-sign-message-presets')
      .getByTestId('sign-message-submit')
      .click()

    await metamask.rejectSignature()

    await expectSignRunRejected(page.getByTestId('sign-run-1'))
  })
})
