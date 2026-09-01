import { NotAuthenticatedError } from '@zerodev/wallet-react'
import {
  DataApiError,
  DataApiNetworkError,
  InvalidDataApiBaseUrlError,
  InvalidDataApiResponseError,
} from '../errors.js'

/**
 * Retry policy for read-only transaction-history queries.
 *
 * TanStack owns retries so every attempt executes the action again and gets a
 * fresh timestamp and stamp. The policy by failure class is:
 *
 * - Local auth/config/response-contract errors: no retry; repeating cannot
 *   connect an account, repair a URL, or reconcile an incompatible response.
 * - 400/401: no retry; the request or authorization must change first.
 * - 429: one retry only when Retry-After tells us when it can succeed.
 * - 502 and network failures: two retries, for three total attempts.
 * - Cancellation and all other HTTP statuses: no retry.
 */
export function transactionHistoryRetry(
  failureCount: number,
  error: unknown,
): boolean {
  if (
    error instanceof NotAuthenticatedError ||
    error instanceof InvalidDataApiBaseUrlError ||
    error instanceof InvalidDataApiResponseError
  ) {
    return false
  }

  if (error instanceof DataApiError) {
    if (error.status === 400 || error.status === 401) return false

    if (error.status === 429) {
      return error.retryAfterMs !== undefined && failureCount < 1
    }

    if (error.status === 502) return failureCount < 2
    return false
  }

  if (error instanceof Error && error.name === 'AbortError') return false
  if (error instanceof DataApiNetworkError) return failureCount < 2
  return false
}

/**
 * Delay paired with `transactionHistoryRetry`:
 *
 * - 429 uses the server's validated Retry-After delay exactly.
 * - Network and 502 retries use 1s, then 2s exponential backoff, capped at
 *   30s if the retry budget is expanded in the future.
 * - Non-retryable errors never consume this value.
 */
export function transactionHistoryRetryDelay(
  attemptIndex: number,
  error: unknown,
): number {
  if (
    error instanceof DataApiError &&
    error.status === 429 &&
    error.retryAfterMs !== undefined
  ) {
    return error.retryAfterMs
  }

  return Math.min(1_000 * 2 ** attemptIndex, 30_000)
}
