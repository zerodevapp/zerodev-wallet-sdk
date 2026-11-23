import type { BrowserContext, Page, Route } from '@playwright/test'
import { matchMock } from './installMockFetch.js'
import { orderMocks } from './orderMocks.js'
import { resolveMockResponse } from './resolveResponse.js'
import type {
  MockRequest,
  MockRequestContext,
  UnmatchedPolicy,
} from './types.js'

/**
 * Serves `MockRequest[]` to a page, or to a whole context, through Playwright's
 * own request interception.
 *
 * Browser-level, so it sees what the page sends regardless of who sent it, and
 * needs no proxy, no CA and no second Playwright config. A context install also
 * covers pages opened later and any iframe they embed, which is what an
 * extension wallet needs — it opens its own tabs. Neither reaches a service
 * worker's requests.
 *
 * Matching is shared with the in-app `fetch` adapter (`installMockFetch`), so a
 * definition behaves the same whichever serves it.
 *
 * No teardown: routes belong to the target, and Playwright gives each test a
 * fresh page.
 */
export type MockHandle = {
  /**
   * How many requests this served. Assert it when a test would otherwise pass
   * on real data — a mock that silently matches nothing is the failure mode
   * worth guarding.
   */
  hits: () => number
  /** Remove this install, leaving any other untouched. */
  dispose: () => Promise<void>
}

const ALL_REQUESTS = '**/*'

export async function routeMocks(
  target: Page | BrowserContext,
  mocks: MockRequest[],
  options: { unmatched?: UnmatchedPolicy } = {},
): Promise<MockHandle> {
  const { unmatched = 'passthrough' } = options
  const ordered = orderMocks(mocks)
  let hits = 0

  const handler = async (route: Route) => {
    const request = route.request()
    const context: MockRequestContext = {
      url: request.url(),
      method: request.method(),
      body: request.postData() ?? '',
    }
    const mock = matchMock(ordered, context)

    if (!mock) {
      if (unmatched === 'block') {
        return route.fulfill({
          status: 501,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'No mock matched',
            method: context.method,
            url: context.url,
          }),
        })
      }
      // `fallback`, not `continue`: handlers run newest-first, and `continue`
      // would send the request off without consulting an earlier install,
      // silently blinding it.
      return route.fallback()
    }

    hits += 1
    // No CORS headers needed, unlike the proxy: a fulfilled response isn't
    // subject to CORS, so mocking a cross-origin backend just works.
    await route.fulfill({
      status: mock.status ?? 200,
      contentType: 'application/json',
      body: JSON.stringify(resolveMockResponse(mock, context)),
    })
  }

  await target.route(ALL_REQUESTS, handler)

  return {
    hits: () => hits,
    dispose: () => target.unroute(ALL_REQUESTS, handler),
  }
}
