/**
 * In-app adapter: serves `MockRequest[]` by patching `fetch` inside the page.
 *
 * The counterpart to `routeMocks`, which serves the same definitions to
 * Playwright via browser-level interception. This one exists for driving the app
 * by hand — it needs no test runner, just the app itself.
 *
 * `matchMock` here is the shared matcher both adapters use, so a definition
 * behaves the same either way. Keep it that way; two matchers would drift.
 *
 * Runs in the browser, so it must stay free of anything Node-only — importing
 * such a module here would drag it into the client bundle.
 */

import { echoJsonRpcId } from './jsonRpc.js'
import { orderMocks } from './orderMocks.js'
import type { MockRequest, UnmatchedPolicy } from './types.js'

let active: MockRequest[] = []
let unmatchedPolicy: UnmatchedPolicy = 'passthrough'
/** Non-null only while installed; doubles as the install guard. */
let nativeFetch: typeof globalThis.fetch | null = null

export function isMockFetchInstalled(): boolean {
  return nativeFetch !== null
}

/** Replace the active mocks. Safe to call before or after installing. */
export function setMocks(
  mocks: MockRequest[],
  unmatched: UnmatchedPolicy = 'passthrough',
): void {
  active = orderMocks(mocks)
  unmatchedPolicy = unmatched
}

export function getActiveMocks(): readonly MockRequest[] {
  return active
}

/**
 * True when every key in `expected` is present in `actual` with a deep-equal
 * value. Extra keys on `actual` are ignored — the same subset semantics as
 * subset semantics, so `{ method: 'eth_call' }` matches any JSON-RPC envelope
 * for that method.
 */
export function jsonBodyIncludes(actual: unknown, expected: unknown): boolean {
  if (expected === null || typeof expected !== 'object') {
    return actual === expected
  }
  if (actual === null || typeof actual !== 'object') return false

  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || actual.length < expected.length) return false
    return expected.every((item, index) =>
      jsonBodyIncludes(actual[index], item),
    )
  }
  if (Array.isArray(actual)) return false

  return Object.entries(expected as Record<string, unknown>).every(
    ([key, value]) =>
      key in (actual as Record<string, unknown>) &&
      jsonBodyIncludes((actual as Record<string, unknown>)[key], value),
  )
}

function urlMatches(pattern: string | RegExp, url: string): boolean {
  return typeof pattern === 'string' ? pattern === url : pattern.test(url)
}

/** First match wins, after `orderMocks` has sorted by priority. */
export function matchMock(
  mocks: readonly MockRequest[],
  request: { url: string; method: string; body: string },
): MockRequest | undefined {
  return mocks.find((mock) => {
    if (mock.method !== request.method) return false
    if (!urlMatches(mock.url, request.url)) return false
    if (mock.bodyIncludes && !request.body.includes(mock.bodyIncludes)) {
      return false
    }
    if (mock.payload) {
      let parsed: unknown
      try {
        parsed = JSON.parse(request.body)
      } catch {
        return false
      }
      if (!jsonBodyIncludes(parsed, mock.payload)) return false
    }
    return true
  })
}

function jsonResponse(body: object, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

async function describeRequest(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<{ url: string; method: string; body: string }> {
  if (input instanceof Request) {
    let body = ''
    try {
      body = await input.clone().text()
    } catch {
      // Unreadable or already-consumed body; match on url + method only.
    }
    return { url: input.url, method: input.method.toUpperCase(), body }
  }

  const url = input instanceof URL ? input.href : String(input)
  const method = (init?.method ?? 'GET').toUpperCase()
  // Only string bodies are matchable; FormData/Blob/streams fall through as ''.
  const body = typeof init?.body === 'string' ? init.body : ''
  return { url, method, body }
}

/**
 * Patch `globalThis.fetch`. Idempotent, and a no-op where there is no `fetch`
 * (SSR passes through untouched, so a server render never sees mocks).
 *
 * `globalThis` rather than `window` so the same function is exercisable under a
 * Node test runner — the adapter's tests run in the integration config.
 */
export function installMockFetch(options?: {
  mocks?: MockRequest[]
  unmatched?: UnmatchedPolicy
}): void {
  if (options?.mocks) setMocks(options.mocks, options.unmatched)
  if (typeof globalThis.fetch !== 'function' || nativeFetch) return

  // Keep the ORIGINAL for restoring; bind a separate copy for calling. Storing
  // the bound copy would mean uninstall never restores what was there, so
  // install/uninstall cycles would stack a wrapper each time.
  nativeFetch = globalThis.fetch
  const passthrough = globalThis.fetch.bind(globalThis)

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = await describeRequest(input, init)
    const mock = matchMock(active, request)

    if (mock) {
      return jsonResponse(
        echoJsonRpcId(mock.response, request.body),
        mock.status ?? 200,
      )
    }

    if (unmatchedPolicy === 'block') {
      console.warn(
        `[mock] blocked unmatched ${request.method} ${request.url}${
          request.body ? ` body=${request.body}` : ''
        }`,
      )
      return jsonResponse(
        {
          error: 'No mock matched',
          method: request.method,
          url: request.url,
        },
        501,
      )
    }

    return passthrough(input, init)
  }
}

export function uninstallMockFetch(): void {
  if (!nativeFetch) return
  globalThis.fetch = nativeFetch
  nativeFetch = null
  active = []
  unmatchedPolicy = 'passthrough'
}
