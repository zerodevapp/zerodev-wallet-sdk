/**
 * Browser E2E test for post-authentication operations.
 *
 * After magic-link login:
 * 1. Sign a message via the "Sign Message" tab
 * 2. Send a transaction via the "Send Transaction" tab
 * 3. Copy wallet address
 * 4. Logout and verify redirect to login page
 */

import { expect, type Page, test } from '@playwright/test'
import { loginWithMagicLink } from '../helpers/ui-login.js'

async function signMessage(page: Page) {
  await page
    .getByRole('navigation')
    .getByRole('button', { name: /Sign Anything/i })
    .click()
  await page
    .getByRole('button', { name: /Sign Anything/i })
    .nth(1)
    .click()
  await expect(page.getByText('Message signed successfully')).toBeVisible({
    timeout: 30_000,
  })
}

/**
 * Sample EIP-712 typed data using Arbitrum Sepolia chainId (421614).
 * Must match a chain allowed by the project, otherwise the backend rejects it.
 */
const TYPED_DATA_SAMPLE = JSON.stringify(
  {
    domain: {
      name: 'Ether Mail',
      version: '1',
      chainId: 421614,
      verifyingContract: '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC',
    },
    types: {
      Person: [
        { name: 'name', type: 'string' },
        { name: 'wallet', type: 'address' },
      ],
      Mail: [
        { name: 'from', type: 'Person' },
        { name: 'to', type: 'Person' },
        { name: 'contents', type: 'string' },
      ],
    },
    primaryType: 'Mail',
    message: {
      from: {
        name: 'Cow',
        wallet: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826',
      },
      to: {
        name: 'Bob',
        wallet: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
      },
      contents: 'Hello, Bob!',
    },
  },
  null,
  2,
)

import { createNewAccount, ping } from '../helpers/temp-email.js'

test.describe('Post-Auth Operations', () => {
  test.beforeEach(async () => {
    try {
      await ping()
    } catch {
      test.skip(true, 'Email service unavailable')
    }
  })

  test('should sign a message after login', async ({ page }) => {
    const emailAccount = await createNewAccount()
    await loginWithMagicLink(page, emailAccount.address, emailAccount.authToken)

    await signMessage(page)
    console.log('Message signed successfully')
  })

  test('should auto-refresh, sign, reload, and sign again', async ({
    page,
  }) => {
    test.setTimeout(180_000)
    const emailAccount = await createNewAccount()
    await loginWithMagicLink(page, emailAccount.address, emailAccount.authToken)

    const initialSessionId = await page.evaluate(() =>
      localStorage.getItem('@zerodev/active_session'),
    )
    if (!initialSessionId) throw new Error('Expected an active browser session')

    await page.evaluate((sessionId) => {
      const stored = localStorage.getItem(sessionId)
      if (!stored) throw new Error('Expected the active session record')
      const session = JSON.parse(stored)
      session.expiry = Date.now() + 65_000
      localStorage.setItem(sessionId, JSON.stringify(session))
    }, initialSessionId)

    const refreshResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        response.url().endsWith('/auth/login/stamp'),
      { timeout: 30_000 },
    )
    await page.reload()
    await expect(page.getByText('Your Smart Wallet')).toBeVisible({
      timeout: 60_000,
    })

    const refreshResponse = await refreshResponsePromise
    expect(refreshResponse.ok()).toBe(true)
    await refreshResponse.finished()

    await expect
      .poll(
        () =>
          page.evaluate(() => localStorage.getItem('@zerodev/active_session')),
        { timeout: 30_000 },
      )
      .not.toBe(initialSessionId)

    await signMessage(page)
    await page.reload()
    await expect(page.getByText('Your Smart Wallet')).toBeVisible({
      timeout: 60_000,
    })
    await signMessage(page)
  })

  test('should sign typed data (EIP-712) after login', async ({ page }) => {
    const emailAccount = await createNewAccount()
    await loginWithMagicLink(page, emailAccount.address, emailAccount.authToken)

    // Click the "Sign Message" tab
    await page
      .getByRole('navigation')
      .getByRole('button', { name: /Sign Anything/i })
      .click()

    // Switch to Typed Data mode
    await page.getByRole('button', { name: /Typed Data \(EIP-712\)/i }).click()

    // Fill with typed data using a valid chainId for the project
    const textarea = page.getByPlaceholder('Enter EIP-712 typed data JSON...')
    await textarea.fill(TYPED_DATA_SAMPLE)

    // Click the sign action button (nth(1) — nth(0) is the nav tab)
    await page
      .getByRole('button', { name: /Sign Anything/i })
      .nth(1)
      .click()

    // Exact match avoids the kit's "Signature Request" heading; match only
    // the result-panel label.
    await expect(page.getByText('Message signed successfully')).toBeVisible({
      timeout: 30_000,
    })
    console.log('Typed data (EIP-712) signed successfully')
  })

  test('should mint NFT (send transaction) after login', async ({ page }) => {
    const emailAccount = await createNewAccount()
    await loginWithMagicLink(page, emailAccount.address, emailAccount.authToken)

    // Navigate to the "Gas-free Mint" tab
    await page
      .getByRole('navigation')
      .getByRole('button', { name: /Gas-free Mint/i })
      .click()

    // Fixed-mode tab hides the mode selector, so there is a single Mint button.
    // Exact match avoids the "Gas-free Mint" tab.
    await page.getByRole('button', { name: 'Mint', exact: true }).click()

    // Wait for success
    await expect(page.getByText(/NFT minted/i)).toBeVisible({
      timeout: 60_000,
    })
    console.log('Mint NFT (send transaction) successful')
  })

  test('should logout and redirect to login page', async ({ page }) => {
    const emailAccount = await createNewAccount()
    await loginWithMagicLink(page, emailAccount.address, emailAccount.authToken)

    // Click logout
    await page.getByRole('button', { name: /Logout/i }).click()

    // Verify redirect to the login page. Post-logout the landing auto-restarts
    // the auth flow, so the login UI reappears (no manual Reconnect step).
    await page.waitForURL('/', { timeout: 15_000 })
    await expect(page.getByText('Continue to your wallet')).toBeVisible({
      timeout: 30_000,
    })
    console.log('Logout successful')
  })
})
