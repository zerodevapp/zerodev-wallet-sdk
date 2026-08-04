/**
 * Proves a mocked response reaches the UI.
 *
 * Login is real; only `GET /user-wallet` is mocked, and the route is installed
 * before logging in so auth traffic passes through and the address is already
 * mocked by the time the strip renders.
 *
 * The expected address is fabricated, so the assertion can only pass if the mock
 * served it. Compared case-insensitively because wagmi hands back a checksummed
 * address and the mock supplies lowercase hex.
 */
import { expect, test } from '@playwright/test'
import { createNewAccount, ping } from '../helpers/temp-email.js'
import { loginWithOtp } from '../helpers/ui-login.js'
import {
  MOCK_WALLET_ADDRESS,
  userWallet,
} from '../mocks/definitions/userWallet.js'
import { routeMocks } from '../mocks/routeMocks.js'

test.describe('Mocked user wallet', () => {
  test.beforeEach(async () => {
    try {
      await ping()
    } catch {
      test.skip(true, 'Email service unavailable')
    }
  })

  test('wallet strip shows the mocked address', async ({ page }) => {
    const mocked = await routeMocks(page, userWallet)

    const account = await createNewAccount()
    await loginWithOtp(page, account.address, account.authToken)

    await expect(page.getByTestId('wallet-address')).toHaveText(
      new RegExp(`^${MOCK_WALLET_ADDRESS}$`, 'i'),
      { timeout: 30_000 },
    )
    // A mock that matches nothing would leave the real address on screen, which
    // is a plausible-looking pass. Assert it actually served.
    expect(mocked.hits()).toBeGreaterThan(0)
  })
})
