import type { MockRequest } from './types.js'

/**
 * Order mocks by descending priority so higher-priority mocks are registered
 * first. Mockttp uses first-matching-rule-wins, so registration order is how a
 * per-test override beats a preset's baseline. A missing priority counts as 0.
 *
 * Stable within equal priority (input order preserved) and non-mutating.
 */
export function orderMocks(mocks: MockRequest[]): MockRequest[] {
  return [...mocks].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
}
