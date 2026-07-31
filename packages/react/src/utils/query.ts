/**
 * A request failed with a 4xx status. The cause (expired/invalid session,
 * unauthorized, bad input) will not change on retry, so retrying only amplifies
 * backend auth-failure noise — one dead session key otherwise turns into 3–6
 * identical failures (DPL-662).
 *
 * Duck-typed on `status` so it works for the SDK's `RestRequestError` without
 * importing it (timeouts and network errors have no `status`, so they still
 * retry).
 */
export function isClientError(error: unknown): boolean {
  const status = (error as { status?: unknown } | null | undefined)?.status
  return typeof status === 'number' && status >= 400 && status < 500
}

/**
 * Default TanStack Query `retry` predicate for authenticated SDK queries: retry
 * transient failures (network / 5xx) up to twice, never retry a 4xx. Exported so
 * consumers can reuse it in their own QueryClient `defaultOptions.queries.retry`.
 */
export function shouldRetryRequest(
  failureCount: number,
  error: unknown,
): boolean {
  return !isClientError(error) && failureCount < 2
}
