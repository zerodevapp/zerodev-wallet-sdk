/**
 * The Zerion harness itself: that the cached profile really is the test wallet.
 */

import { expect } from '@playwright/test'
import { mnemonicToAccount } from 'viem/accounts'
import { test } from '../fixtures/zerion.js'
import { TEST_WALLET } from '../helpers/wallet-credentials.js'

/** Derived here rather than hardcoded, so editing TEST_WALLET moves the assertion with it. */
const ACCOUNT = mnemonicToAccount(TEST_WALLET.secretRecoveryPhrase).address

/** Zerion renders an address as the first 7 characters, an ellipsis, then the last 5. */
const abbreviated = (address: string) =>
  `${address.slice(0, 7)}…${address.slice(-5)}`

test.describe('Zerion harness', () => {
  test('the cached profile opens unlocked on the imported account', async ({
    walletPage,
  }) => {
    // The lock screen is the failure this guards: if the unlock stopped
    // working, the page sits on #/login and the address never renders.
    await expect(
      walletPage.getByPlaceholder('Password'),
      'the wallet is still locked — unlockIfLocked did not complete',
    ).toBeHidden()

    await expect(
      walletPage.getByText(abbreviated(ACCOUNT), { exact: false }),
      `the wallet did not open on ${ACCOUNT}`,
    ).toBeVisible({ timeout: 30_000 })
  })
})
