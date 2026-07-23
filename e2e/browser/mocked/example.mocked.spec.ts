/**
 * Smoke test for the mocking harness plumbing: the auto worker-fixture starts
 * the proxy, `withMocks` applies a preset, the proxied browser loads the app.
 *
 * It asserts the harness wiring, not a specific mocked UI state — real specs
 * (built on captured preset data) assert app behavior. Landing page is chosen
 * because it renders without backend calls, keeping this low-flake.
 */
import { expect } from '@playwright/test'
import { presets } from '../../mocks/presets/index.js'
import { test } from '../../mocks/test.js'
import { withMocks } from '../../mocks/withMocks.js'

test('harness applies mocks and the proxied app loads', async ({ page }) => {
  await withMocks({ mocks: presets.example }, async ({ mockServer }) => {
    // Mocks (plus the passthrough fallback) are registered on the live proxy.
    expect((await mockServer.getMockedEndpoints()).length).toBeGreaterThan(0)

    await page.goto('/')
    await expect(page.getByText('Continue to your wallet')).toBeVisible()
  })
})
