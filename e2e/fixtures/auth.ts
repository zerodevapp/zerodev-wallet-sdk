/**
 * Playwright auth fixtures that centralise USE_REAL_EMAIL branching.
 *
 * Consumers import `test` and `expect` from this module instead of
 * `@playwright/test`.  The `otpSession` and `magicLinkSession` fixtures
 * automatically:
 *   - In mock mode  : register route mocks and return a known OTP code.
 *   - In real-email mode: ping the email service (skip on failure), create a
 *     temp inbox, and return the authToken for later polling.
 */

import { test as base, expect } from '@playwright/test'
import { isRealEmail } from '../helpers/env-utils.js'
import { setupOtpMocks } from '../helpers/mock-backend.js'
import { createNewAccount, ping } from '../helpers/temp-email.js'

export type OtpSession = {
  email: string
  /** Known OTP code in mock mode; null in real-email mode (polled after UI submit). */
  otpCode: string | null
  /** mail.tm auth token; only set in real-email mode. */
  authToken: string | null
}

type AuthFixtures = {
  otpSession: OtpSession
  magicLinkSession: OtpSession
}

export const test = base.extend<AuthFixtures>({
  otpSession: async ({ page }, use, testInfo) => {
    if (isRealEmail()) {
      try {
        await ping()
      } catch {
        testInfo.skip(true, 'Email service unavailable')
        return
      }
      const account = await createNewAccount()
      await use({
        email: account.address,
        otpCode: null,
        authToken: account.authToken,
      })
    } else {
      const { otpCode } = await setupOtpMocks(page)
      await use({
        email: `mock-${Date.now()}@test.example.com`,
        otpCode,
        authToken: null,
      })
    }
  },

  magicLinkSession: async ({ page }, use, testInfo) => {
    if (isRealEmail()) {
      try {
        await ping()
      } catch {
        testInfo.skip(true, 'Email service unavailable')
        return
      }
      const account = await createNewAccount()
      await use({
        email: account.address,
        otpCode: null,
        authToken: account.authToken,
      })
    } else {
      const { otpCode } = await setupOtpMocks(page)
      await use({
        email: `mock-${Date.now()}@test.example.com`,
        otpCode,
        authToken: null,
      })
    }
  },
})

export { expect }
