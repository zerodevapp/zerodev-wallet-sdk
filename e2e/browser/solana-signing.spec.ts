/**
 * Browser E2E for the signing handle's capability rows, driven by a mocked
 * wallet so the account can declare less than the wallet implements.
 *
 * No real wallet can be made to do that on demand, which is why this case is
 * mocked rather than run through MetaMask.
 */

import { expect, test } from '@playwright/test'
import { expectConnected } from '../helpers/connector-bar.js'
import { LAB_TIMEOUT_MS } from '../helpers/constants.js'
import { openTxSigningArea } from '../helpers/lab-nav.js'
import {
  MOCK_SOLANA_WALLET,
  type MockSolanaWallet,
  registerMockSolanaWallets,
} from '../helpers/mock-solana-wallet.js'
import {
  expectSignUpSheet,
  openSignIn,
  openWalletPreset,
} from '../helpers/ui-login.js'

/**
 * A wallet that implements two features on an account declaring only one.
 */
const PARTIAL_ACCOUNT: MockSolanaWallet = {
  ...MOCK_SOLANA_WALLET,
  features: ['solana:signMessage', 'solana:signTransaction'],
  accountFeatures: ['solana:signTransaction'],
}

test.describe('The Solana signing handle', () => {
  test.describe.configure({ timeout: 180_000 })

  test('offers a method only where the account declares it', async ({
    page,
  }) => {
    await registerMockSolanaWallets(page, [PARTIAL_ACCOUNT])
    await openWalletPreset(page, { solana: true })

    await openSignIn(page, 'solana')
    await expectSignUpSheet(page)
    await page
      .getByRole('button', { name: new RegExp(`^${MOCK_SOLANA_WALLET.name}`) })
      .click()
    await expectConnected(page, 'solana')

    await openTxSigningArea(page, 'signing')
    await expect(page.getByTestId('case-solana-signing')).toHaveAttribute(
      'data-connected',
      'true',
      { timeout: LAB_TIMEOUT_MS },
    )

    const row = (method: string) => page.getByTestId(`solana-handle-${method}`)
    const button = (method: string) => page.getByTestId(`solana-fire-${method}`)

    // The wallet implements this one; the account does not declare it.
    await expect(row('signMessage')).toHaveAttribute('data-available', 'false')
    await expect(button('signMessage')).toBeDisabled()

    // Declared by both, so the null row above disabled only its own button.
    await expect(row('signTransaction')).toHaveAttribute(
      'data-available',
      'true',
    )
    await expect(button('signTransaction')).toBeEnabled()

    // Declared by neither.
    await expect(row('signAndSendTransaction')).toHaveAttribute(
      'data-available',
      'false',
    )
    await expect(button('signAndSendTransaction')).toBeDisabled()

    // A method being null is a normal state, not a broken connection.
    await expectConnected(page, 'solana')
  })
})
