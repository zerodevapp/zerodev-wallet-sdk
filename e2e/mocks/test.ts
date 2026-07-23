import { test as base } from '@playwright/test'
import { startSharedServer, stopSharedServer } from './server.js'

/**
 * Base `test` for mocked specs. An auto, worker-scoped fixture starts the
 * shared Mockttp proxy once per worker and stops it at the end — in the SAME
 * process as the specs, so `withMocks`/`getMockServer` see it (a Playwright
 * `globalSetup` runs in a different process and would not).
 *
 * Specs still declare their mocks via `withMocks(...)`; this fixture only owns
 * the server lifecycle.
 */
export const test = base.extend<Record<string, never>, { mockProxy: void }>({
  mockProxy: [
    // biome-ignore lint/correctness/noEmptyPattern: Playwright requires the first fixture arg to be an object destructuring pattern.
    async ({}, use) => {
      await startSharedServer()
      await use()
      await stopSharedServer()
    },
    { scope: 'worker', auto: true },
  ],
})
