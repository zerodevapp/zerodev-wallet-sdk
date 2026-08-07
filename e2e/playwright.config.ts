import { existsSync } from 'node:fs'
import * as path from 'node:path'
import { loadEnvFile } from 'node:process'
import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const demoAppDir = path.resolve(__dirname, '../apps/zerodev-signer-demo')
const envPath = path.resolve(__dirname, '../.env')
if (existsSync(envPath)) loadEnvFile(envPath)

// Only the OTP demo server (below) consumes this, and only for local runs.
// Don't require it at config load, or `--list`, single-project, and magic-link
// runs would all demand an OTP project id they never use.
const otpProjectId = process.env.ZD_OTP_PROJECT_ID

const magicLinkBaseUrl = process.env.DEMO_APP_URL || 'http://localhost:3000'
const otpBaseUrl = process.env.OTP_DEMO_APP_URL || 'http://localhost:3001'

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
  projects: [
    {
      name: 'chromium',
      testIgnore: /otp\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: magicLinkBaseUrl },
    },
    {
      name: 'chromium-otp',
      testMatch: /otp\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: otpBaseUrl },
    },
  ],
  ...(process.env.CI
    ? {}
    : {
        webServer: [
          {
            command: `cd ${demoAppDir} && pnpm dev --port 3000`,
            url: magicLinkBaseUrl,
            env: { NEXT_DIST_DIR: '.next-e2e-magic-link' },
            reuseExistingServer: true,
            timeout: 30_000,
          },
          // The OTP demo server (:3001) is only needed by otp.spec.ts. Start it
          // only when an OTP project id is configured, so magic-link-only and
          // `--list` runs don't require ZD_OTP_PROJECT_ID.
          ...(otpProjectId
            ? [
                {
                  command: `cd ${demoAppDir} && pnpm dev --port 3001`,
                  url: otpBaseUrl,
                  env: {
                    NEXT_DIST_DIR: '.next-e2e-otp',
                    NEXT_PUBLIC_ZERODEV_PROJECT_ID: otpProjectId,
                  },
                  reuseExistingServer: true,
                  timeout: 30_000,
                },
              ]
            : []),
        ],
      }),
})
