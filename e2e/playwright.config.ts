import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const demoAppDir = path.resolve(__dirname, '../apps/zerodev-signer-demo')

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
        reuseExistingServer: true,
        timeout: 30_000,
      },
})
