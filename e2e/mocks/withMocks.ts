import type { Mockttp } from 'mockttp'
import { applyMocks, getMockServer, reset } from './server.js'
import type { TestSuiteFunction, WithMockOptions } from './types.js'

/**
 * Apply `options.mocks` to `server`, run `testSuite`, then always reset the
 * server's rules — whether the suite passed or threw. Errors from the suite
 * propagate unchanged; they are never swallowed (a swallowed error would make
 * a failing test pass).
 *
 * Takes the server explicitly so it can be unit-tested; production callers use
 * {@link withMocks}, which binds it to the shared server.
 */
export async function runWithMocks(
  server: Mockttp,
  options: WithMockOptions,
  testSuite: TestSuiteFunction,
): Promise<void> {
  await applyMocks(server, options.mocks, options.unmatched ?? 'passthrough')
  try {
    await testSuite({ mockServer: server })
  } finally {
    await reset(server)
  }
}

/**
 * Wrapper for Playwright specs. Loads a list of mocks into the shared proxy
 * (started once in globalSetup), runs the test body, then resets the rules.
 *
 * @example
 * await withMocks({ mocks: [...insufficientFunds] }, async ({ mockServer }) => {
 *   await page.goto('/dashboard')
 *   await expect(page.getByText('Insufficient funds')).toBeVisible()
 * })
 */
export async function withMocks(
  options: WithMockOptions,
  testSuite: TestSuiteFunction,
): Promise<void> {
  return runWithMocks(getMockServer(), options, testSuite)
}
