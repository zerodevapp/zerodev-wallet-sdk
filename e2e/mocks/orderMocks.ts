import type { MockRequest } from './types.js'

/**
 * Order mocks by descending priority. Both adapters take the first match, so
 * order is how a per-test override beats a baseline set. A missing priority
 * counts as 0.
 *
 * Stable within equal priority (input order preserved) and non-mutating.
 */
export function orderMocks(mocks: MockRequest[]): MockRequest[] {
  return [...mocks].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
}
