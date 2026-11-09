/**
 * Shared Playwright helpers for getting into the QA lab through its UI.
 * Extracted from post-auth.spec.ts so multiple browser specs can reuse them.
 */

import { expect, type Page } from '@playwright/test'
import {
  EMAIL_POLL_INTERVAL_MS,
  EMAIL_POLL_TIMEOUT_MS,
  OTP_CODE_LENGTH,
} from './constants.js'
import {
  extractMagicLinkUrl,
  extractOtpCode,
  extractOtpCodeFromMagicLinkUrl,
} from './otp-utils.js'
import { searchForNewEmail } from './temp-email.js'

/** Which connector-bar button opens the flow. */
export type SignInNamespace = 'eip155' | 'solana' | 'all'

/**
 * Opens the sign-in flow from the connector bar.
 */
export async function openSignIn(
  page: Page,
  namespace: SignInNamespace = 'eip155',
): Promise<void> {
  // Disabled while that namespace is already connected or restoring, so waiting
  // on enabled also waits out a silent reconnect.
  const button = page.getByTestId(`connector-connect-${namespace}`)
  await expect(button).toBeEnabled({ timeout: 60_000 })
  await button.click()
}

/**
 * Waits for the authenticated lab. The lab has no post-login route — its auth
 * gate swaps the login surface for the lab at the same URL once wagmi reports
 * connected, so there is no navigation to wait on.
 */
export async function expectLabReady(page: Page): Promise<void> {
  await expect(page.getByTestId('wallet-strip')).toBeVisible({
    timeout: 60_000,
  })
  await expect(page.getByTestId('wallet-address')).toHaveText(
    /^0x[0-9a-fA-F]{40}$/,
    { timeout: 60_000 },
  )
}

/**
 * Clicks logout and waits until the login surface is back.
 *
 * Waits on the UI, not the URL: logout keeps the config params so the path never
 * changes, and returning early lets the next navigation abort the disconnect,
 * leaving the session alive.
 */
export async function logoutAndExpectLoginSurface(page: Page): Promise<void> {
  await page.getByTestId('wallet-logout').click()

  await expect(page.getByTestId('wallet-strip')).toBeHidden({ timeout: 60_000 })
  // The hint, not a sign-in surface: the connector bar survives the gate, so
  // this is the only element that only renders while signed out and idle.
  await expect(page.getByTestId('signed-out-hint')).toBeVisible({
    timeout: 60_000,
  })
}

/**
 * Completes plain-code OTP login through the UI, landing on the lab.
 *
 * The lab takes its wallet config from URL params, so `?authFlavor=otp` selects
 * both the OTP project and the OTP email method together — rather than pointing
 * at a separately-built server as the signer demo does.
 */
export async function loginWithOtp(
  page: Page,
  email: string,
  authToken: string,
): Promise<void> {
  await page.goto('/?authFlavor=otp')
  await openSignIn(page)
  await page.getByPlaceholder('Enter your email').fill(email)
  await page.getByPlaceholder('Enter your email').press('Enter')
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
  // A magic-link email here means the OTP project has a magic_link_template it
  // shouldn't, and the SDK's silent OTP fallback would hide that.
  if (extractOtpCodeFromMagicLinkUrl(emailContent)) {
    throw new Error('Plain-OTP project unexpectedly sent a magic-link email')
  }
  const otpCode = extractOtpCode(emailContent, OTP_CODE_LENGTH, true)
  if (!otpCode) throw new Error('OTP email did not contain a verification code')

  await page.getByLabel('Verification code').fill(otpCode)
  await page.getByRole('button', { name: /Confirm code/i }).click()

  await expectLabReady(page)
}

/** Completes magic-link login through the UI, landing on the lab. */
export async function loginWithMagicLink(
  page: Page,
  email: string,
  authToken: string,
): Promise<void> {
  // Warm /verify so a cold Next dev compile doesn't trigger Fast Refresh while
  // the emailed link is redeeming. Production builds already have the route.
  await page.request.get('/verify')

  await page.goto('/')
  await openSignIn(page)
  await page.getByPlaceholder('Enter your email').fill(email)
  await page.getByPlaceholder('Enter your email').press('Enter')
  await expect(page.getByText(/check your email/i)).toBeVisible({
    timeout: 30_000,
  })

  const emailContent = await searchForNewEmail(
    authToken,
    EMAIL_POLL_INTERVAL_MS,
    EMAIL_POLL_TIMEOUT_MS,
  )
  const magicLinkUrl = extractMagicLinkUrl(emailContent)
  if (!magicLinkUrl) {
    throw new Error('Magic-link project sent no verification link')
  }

  // Navigate the actual emailed link rather than reconstructing /verify?code=
  // against baseURL, so a change to the project's magic_link_template (host or
  // path) is exercised here instead of silently passing. The template can't
  // carry config params, so /verify redeems under the default flavor — which is
  // why magic link is the default, and why this helper passes no param above.
  await page.goto(magicLinkUrl)
  await expectLabReady(page)
}
