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
import {
  createRealEmailOtpSession,
  type OtpSession,
} from '../helpers/otp-session.js'
import { setupPageTracing } from '../helpers/tracing.js'

export type { OtpSession }

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
      let session: OtpSession
      try {
        session = await createRealEmailOtpSession()
      } catch {
        testInfo.skip(true, 'Email service unavailable')
        return
      }
      await use(session)
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
      let session: OtpSession
      try {
        session = await createRealEmailOtpSession()
      } catch {
        testInfo.skip(true, 'Email service unavailable')
        return
      }
      await use(session)
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
      let session: OtpSession
      try {
        session = await createRealEmailOtpSession()
      } catch {
        testInfo.skip(true, 'Email service unavailable')
        return
      }
      await use(session)
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
