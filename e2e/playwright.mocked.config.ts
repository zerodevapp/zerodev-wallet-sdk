import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'
import { DEFAULT_MOCK_PORT } from './mocks/server.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const demoAppDir = path.resolve(__dirname, '../apps/zerodev-signer-demo')

/**
 * Mocked browser-e2e config. The demo app runs with its real URLs; the browser
 * is routed through the Mockttp proxy (started by the auto worker-fixture in
 * `mocks/test.ts`), so all external backend traffic can be intercepted. The
 * app's own origin bypasses the proxy so HTML/HMR load directly.
 *
 * Kept separate from `playwright.config.ts` so the real-backend suite is
 * untouched.
 */
export default defineConfig({
  testDir: './browser/mocked',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['html'], ['github']] : [['html']],
  timeout: 120_000,
  expect: { timeout: 30_000 },
  use: {
    baseURL: process.env.DEMO_APP_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // The proxy MITMs HTTPS with a self-signed CA; accept it instead of
    // installing the cert.
    ignoreHTTPSErrors: true,
    proxy: {
      server: `http://localhost:${DEFAULT_MOCK_PORT}`,
      // App + HMR are local; only external backend calls go through the proxy.
      bypass: 'localhost, 127.0.0.1',
    },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.CI
    ? undefined
    : {
        command: `cd ${demoAppDir} && pnpm dev`,
        url: 'http://localhost:3000',
        reuseExistingServer: true,
        timeout: 30_000,
      },
})
