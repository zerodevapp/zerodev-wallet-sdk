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
import { setupOtpMocks, setupSigningMocks } from '../helpers/mock-backend.js'
import { createNewAccount, ping } from '../helpers/temp-email.js'
import { setupPageTracing } from '../helpers/tracing.js'

export type OtpSession = {
  email: string
  /** Known OTP code in mock mode; null in real-email mode (polled after UI submit). */
  otpCode: string | null
  /** mail.tm auth token; only set in real-email mode. */
  authToken: string | null
}

type AuthFixtures = {
  _tracing: void
  otpSession: OtpSession
  magicLinkSession: OtpSession
  authenticatedSession: OtpSession // OTP + signing mocks combined
}

export const test = base.extend<AuthFixtures>({
  // Auto fixture: runs for every test that imports from this module.
  _tracing: [
    async ({ page }, use) => {
      await setupPageTracing(page)
      await use()
    },
    { auto: true },
  ],

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

  authenticatedSession: async ({ page }, use, testInfo) => {
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
      await setupSigningMocks(page)
      await use({
        email: `mock-${Date.now()}@test.example.com`,
        otpCode,
        authToken: null,
      })
    }
  },
})

export { expect }
