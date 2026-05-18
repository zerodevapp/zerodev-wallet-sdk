/**
 * Browser E2E test for post-authentication operations.
 *
 * After OTP login:
 * 1. Sign a message via the "Sign Message" tab
 * 2. Send a transaction via the "Send Transaction" tab
 * 3. Copy wallet address
 * 4. Logout and verify redirect to login page
 */

import { expect, test } from '@playwright/test'
import {
  EMAIL_POLL_INTERVAL_MS,
  EMAIL_POLL_TIMEOUT_MS,
} from '../helpers/constants.js'

// Demo app uses 6-digit OTP codes (configured in zerodev-signer-demo)
const DEMO_APP_OTP_LENGTH = 6

import { extractOtpCode } from '../helpers/otp-utils.js'

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

import {
  createNewAccount,
  ping,
  searchForNewEmail,
} from '../helpers/temp-email.js'

/** Helper to complete OTP login through the UI */
async function loginWithOtp(
  page: import('@playwright/test').Page,
  email: string,
  authToken: string,
) {
  // Debug flag renders separate magic-link + OTP buttons regardless of
  // demo's emailAuthMethod config.
  await page.goto('/?renderBothEmailButtons=true')
  await page.getByPlaceholder('Enter your email').fill(email)
  await page
    .getByRole('button', { name: /Continue with email OTP code/i })
    .click()
  await expect(
    page.getByText(`Enter the code from the email we sent to ${email}`, {
      exact: false,
    }),
  ).toBeVisible({ timeout: 30_000 })

  const emailContent = await searchForNewEmail(
    authToken,
    EMAIL_POLL_INTERVAL_MS,
    EMAIL_POLL_TIMEOUT_MS,
  )
  const otpCode = extractOtpCode(emailContent, DEMO_APP_OTP_LENGTH, true)
  expect(otpCode).toBeTruthy()

  await page.getByLabel('Verification code').fill(otpCode!)
  await page.getByRole('button', { name: /Confirm code/i }).click()

  await page.waitForURL('**/dashboard', { timeout: 60_000 })
  await expect(page.getByText('Default Wallet')).toBeVisible({
    timeout: 60_000,
  })
}

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
    await loginWithOtp(page, emailAccount.address, emailAccount.authToken)

    // Click the "Sign Message" tab (in the navigation area)
    await page
      .getByRole('navigation')
      .getByRole('button', { name: /Sign Message/i })
      .click()

    // Load sample message
    await page.getByRole('button', { name: /Load Sample/i }).click()

    // Click the "Sign Message" action button (second one — first is the tab)
    await page
      .getByRole('button', { name: /Sign Message/i })
      .nth(1)
      .click()

    // Exact match avoids the kit's "Signature Request" heading; match only
    // the result-panel label.
    await expect(page.getByText('Signature', { exact: true })).toBeVisible({
      timeout: 30_000,
    })
    console.log('Message signed successfully')
  })

  test('should sign typed data (EIP-712) after login', async ({ page }) => {
    const emailAccount = await createNewAccount()
    await loginWithOtp(page, emailAccount.address, emailAccount.authToken)

    // Click the "Sign Message" tab
    await page
      .getByRole('navigation')
      .getByRole('button', { name: /Sign Message/i })
      .click()

    // Switch to Typed Data mode
    await page.getByRole('button', { name: /Typed Data \(EIP-712\)/i }).click()

    // Fill with typed data using a valid chainId for the project
    const textarea = page.getByPlaceholder('Enter EIP-712 typed data JSON...')
    await textarea.fill(TYPED_DATA_SAMPLE)

    // Click the "Sign Typed Data" action button
    await page.getByRole('button', { name: /Sign Typed Data/i }).click()

    // Exact match avoids the kit's "Signature Request" heading; match only
    // the result-panel label.
    await expect(page.getByText('Signature', { exact: true })).toBeVisible({
      timeout: 30_000,
    })
    console.log('Typed data (EIP-712) signed successfully')
  })

  test('should mint NFT (send transaction) after login', async ({ page }) => {
    const emailAccount = await createNewAccount()
    await loginWithOtp(page, emailAccount.address, emailAccount.authToken)

    // Navigate to Send Transaction tab
    await page
      .getByRole('navigation')
      .getByRole('button', { name: /Send Transaction/i })
      .click()

    // Click the "Mint NFT" action button (second match — first is the mode selector)
    await page
      .getByRole('button', { name: /Mint NFT/i })
      .nth(1)
      .click()

    // Wait for success
    await expect(page.getByText('NFT minted successfully!')).toBeVisible({
      timeout: 60_000,
    })
    console.log('Mint NFT (send transaction) successful')
  })

  test('should logout and redirect to login page', async ({ page }) => {
    const emailAccount = await createNewAccount()
    await loginWithOtp(page, emailAccount.address, emailAccount.authToken)

    // Click logout
    await page.getByRole('button', { name: /Logout/i }).click()

    // Verify redirect to login page
    await page.waitForURL('/', { timeout: 15_000 })
    await expect(page.getByText('Continue to your wallet')).toBeVisible()
    console.log('Logout successful')
  })
})
