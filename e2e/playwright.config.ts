import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const demoAppDir = path.resolve(__dirname, '../apps/zerodev-signer-demo')

// In mock mode, inject the test signer key so the Next.js dev server bakes it
// into the client bundle at startup (NEXT_PUBLIC_* are compile-time constants).
// This must happen before the webServer subprocess is spawned.
if (process.env.USE_REAL_EMAIL !== 'true') {
  const keyPath = path.resolve(__dirname, 'fixtures/test-signer-public-key.txt')
  process.env.NEXT_PUBLIC_DANGEROUS_OTP_SIGNER_KEY = readFileSync(
    keyPath,
    'utf-8',
  ).trim()
}

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
    baseURL: process.env.DEMO_APP_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Local backend uses a self-signed TLS cert. Opt in via env so CI /
    // staging runs (where backend has a real cert) stay strict.
    ignoreHTTPSErrors: process.env.ALLOW_SELF_SIGNED_TLS === '1',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: process.env.CI
    ? undefined
    : {
        command: `cd ${demoAppDir} && pnpm dev`,
        url: 'http://localhost:3000',
        // In real-email mode, always start a fresh server so it is built
        // without NEXT_PUBLIC_DANGEROUS_OTP_SIGNER_KEY baked in. Reusing a
        // mock-mode server would activate dangerouslyOverrideOtpSignerPublicKey
        // and change how Turnkey constructs the auth email.
        reuseExistingServer: process.env.USE_REAL_EMAIL !== 'true',
        timeout: 30_000,
      },
})
