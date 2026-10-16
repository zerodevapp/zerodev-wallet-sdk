import { existsSync } from 'node:fs'
import * as path from 'node:path'
import { loadEnvFile } from 'node:process'
import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const labAppDir = path.resolve(__dirname, '../apps/qa-lab-testing')
const envPath = path.resolve(__dirname, '../.env')
if (existsSync(envPath)) loadEnvFile(envPath)

// One server, on 3000. The signer demo runs a second on 3001 for OTP because its
// project id is a build-time constant, so another build is the only way to vary
// it. The QA lab takes its config from URL params instead, so the OTP spec
// selects the OTP project per navigation — and only :3000 is in the ZeroDev
// project's allowed origins, so a second port wouldn't resolve anyway.
const labBaseUrl = process.env.LAB_APP_URL || 'http://localhost:3000'

export default defineConfig({
  testDir: './browser',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['html'], ['github']] : [['html']],
  timeout: 120_000,
  expect: {
    timeout: 30_000,
  },
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Local backend uses a self-signed TLS cert. Opt in via env so CI /
    // staging runs (where backend has a real cert) stay strict.
    ignoreHTTPSErrors: process.env.ALLOW_SELF_SIGNED_TLS === '1',
  },
  // Kept split even though both share an origin: the OTP spec needs a different
  // wallet config, which it selects by URL param rather than its own server.
  projects: [
    {
      name: 'chromium',
      testIgnore: /(otp|metamask.*)\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: labBaseUrl },
    },
    {
      name: 'chromium-otp',
      testMatch: /otp\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: labBaseUrl },
    },
    // Project specific for running the MetaMask extension tests.
    {
      name: 'chromium-metamask',
      testMatch: /metamask.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: labBaseUrl },
    },
  ],
  // Spread rather than `webServer: CI ? undefined : {...}` — with
  // exactOptionalPropertyTypes, assigning undefined to an optional prop fails.
  ...(process.env.CI
    ? {}
    : {
        webServer: {
          command: `cd ${labAppDir} && pnpm dev`,
          url: labBaseUrl,
          reuseExistingServer: true,
          timeout: 30_000,
        },
      }),
})
