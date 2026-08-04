import type { Page } from '@playwright/test'
import { matchMock } from './installMockFetch.js'
import { echoJsonRpcId } from './jsonRpc.js'
import { orderMocks } from './orderMocks.js'
import type { MockRequest, UnmatchedPolicy } from './types.js'

/**
 * Serves `MockRequest[]` to a page through Playwright's own request
 * interception.
 *
 * Browser-level, so it sees what the page sends regardless of who sent it, and
 * needs no proxy, no CA and no second Playwright config. It replaced a Mockttp
 * MITM proxy, which bought nothing here: the SDK only ever uses `fetch`, so
 * there was no traffic the browser couldn't intercept, and the proxy cost a
 * dependency with a pinned transitive, runtime CA generation, and CORS headers
 * on every mocked response.
 *
 * Matching is shared with the in-app `fetch` adapter (`installMockFetch`), so a
 * definition behaves the same whichever serves it.
 *
 * No teardown: routes belong to the page, and Playwright gives each test a fresh
 * one.
 */
export type MockHandle = {
  /**
   * How many requests this served. Assert it when a test would otherwise pass
   * on real data — a mock that silently matches nothing is the failure mode
   * worth guarding.
   */
  hits: () => number
}

export async function routeMocks(
  page: Page,
  mocks: MockRequest[],
  options: { unmatched?: UnmatchedPolicy } = {},
): Promise<MockHandle> {
  const { unmatched = 'passthrough' } = options
  const ordered = orderMocks(mocks)
  let hits = 0

  await page.route('**/*', async (route) => {
    const request = route.request()
    const body = request.postData() ?? ''
    const mock = matchMock(ordered, {
      url: request.url(),
      method: request.method(),
      body,
    })

    if (!mock) {
      if (unmatched === 'block') {
        return route.fulfill({
          status: 501,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'No mock matched',
            method: request.method(),
            url: request.url(),
          }),
        })
      }
      return route.continue()
    }

    hits += 1
    // No CORS headers needed, unlike the proxy: a fulfilled response isn't
    // subject to CORS, so mocking a cross-origin backend just works.
    await route.fulfill({
      status: mock.status ?? 200,
      contentType: 'application/json',
      body: JSON.stringify(echoJsonRpcId(mock.response, body)),
    })
  })

  return { hits: () => hits }
}
