import { NotAuthenticatedError } from '@zerodev/wallet-react'
import { describe, expect, it } from 'vitest'
import {
  DataApiError,
  DataApiNetworkError,
  InvalidDataApiBaseUrlError,
  InvalidDataApiResponseError,
} from '../errors.js'
import {
  isQuotaExhaustedError,
  transactionHistoryRetry,
  transactionHistoryRetryDelay,
} from './query.js'

function dataApiError(
  status: number,
  retryAfterMs?: number,
  body: unknown = { error: 'test' },
) {
  return new DataApiError({
    status,
    body,
    url: 'https://data.example/v1/me/transaction-history',
    ...(retryAfterMs === undefined ? {} : { retryAfterMs }),
  })
}

describe('transactionHistoryRetry', () => {
  it.each([400, 401, 402, 403, 500, 504])(
    'does not retry HTTP %s',
    (status) => {
      expect(transactionHistoryRetry(0, dataApiError(status))).toBe(false)
    },
  )

  it('retries a 502 at most twice', () => {
    const error = dataApiError(502)
    expect(transactionHistoryRetry(0, error)).toBe(true)
    expect(transactionHistoryRetry(1, error)).toBe(true)
    expect(transactionHistoryRetry(2, error)).toBe(false)
  })

  it('retries a 429 once only when Retry-After was valid', () => {
    expect(transactionHistoryRetry(0, dataApiError(429))).toBe(false)
    const delayed = dataApiError(429, 30_000)
    expect(transactionHistoryRetry(0, delayed)).toBe(true)
    expect(transactionHistoryRetry(1, delayed)).toBe(false)
    expect(transactionHistoryRetryDelay(0, delayed)).toBe(30_000)
  })

  it('does not retry a 429 for an exhausted monthly budget', () => {
    const error = dataApiError(429, 30_000, {
      error: 'throttled',
      reason: 'quota_exhausted',
    })
    expect(transactionHistoryRetry(0, error)).toBe(false)
    expect(isQuotaExhaustedError(error)).toBe(true)
  })

  it('does not retry an exhausted budget even without Retry-After', () => {
    const error = dataApiError(429, undefined, {
      error: 'throttled',
      reason: 'quota_exhausted',
    })
    expect(transactionHistoryRetry(0, error)).toBe(false)
  })

  it.each([
    ['a text body', 'rate limited'],
    ['an empty body', undefined],
    ['a null body', null],
    ['an unknown reason', { error: 'throttled', reason: 'maintenance' }],
    ['no reason', { error: 'throttled' }],
  ])('treats a 429 with %s as a plain throttle', (_label, body) => {
    const error = dataApiError(429, 5_000, body)
    expect(isQuotaExhaustedError(error)).toBe(false)
    expect(transactionHistoryRetry(0, error)).toBe(true)
    expect(transactionHistoryRetry(1, error)).toBe(false)
  })

  it.each([
    ['a 503', 503],
    ['a 401', 401],
    ['a network failure', undefined],
  ])(
    'is not an exhausted budget for %s with a quota body',
    (_label, status) => {
      const error =
        status === undefined
          ? new DataApiNetworkError(new TypeError('fetch failed'))
          : dataApiError(status, 5_000, {
              error: 'x',
              reason: 'quota_exhausted',
            })
      expect(isQuotaExhaustedError(error)).toBe(false)
    },
  )

  it('retries a 429 for an upstream throttle once', () => {
    const error = dataApiError(429, 30_000, {
      error: 'throttled',
      reason: 'upstream_throttled',
    })
    expect(transactionHistoryRetry(0, error)).toBe(true)
    expect(transactionHistoryRetry(1, error)).toBe(false)
  })

  it.each([429, 503])(
    'refuses a %s whose Retry-After is more than 30s away instead of retrying early',
    (status) => {
      expect(transactionHistoryRetry(0, dataApiError(status, 30_001))).toBe(
        false,
      )
      expect(transactionHistoryRetry(0, dataApiError(status, 3_600_000))).toBe(
        false,
      )
      expect(transactionHistoryRetry(0, dataApiError(status, 30_000))).toBe(
        true,
      )
    },
  )

  it('waits exactly the server-provided delay when it retries', () => {
    expect(transactionHistoryRetryDelay(0, dataApiError(429, 5_000))).toBe(
      5_000,
    )
    expect(transactionHistoryRetryDelay(0, dataApiError(503, 30_000))).toBe(
      30_000,
    )
  })

  it('retries a 503 once only when Retry-After was valid', () => {
    expect(transactionHistoryRetry(0, dataApiError(503))).toBe(false)
    const delayed = dataApiError(503, 1_000)
    expect(transactionHistoryRetry(0, delayed)).toBe(true)
    expect(transactionHistoryRetry(1, delayed)).toBe(false)
    expect(transactionHistoryRetryDelay(0, delayed)).toBe(1_000)
  })

  it('retries network failures twice with exponential delay', () => {
    const error = new DataApiNetworkError(new TypeError('fetch failed'))
    expect(transactionHistoryRetry(0, error)).toBe(true)
    expect(transactionHistoryRetry(1, error)).toBe(true)
    expect(transactionHistoryRetry(2, error)).toBe(false)
    expect(transactionHistoryRetryDelay(0, error)).toBe(1_000)
    expect(transactionHistoryRetryDelay(1, error)).toBe(2_000)
  })

  it.each([
    new NotAuthenticatedError(),
    new InvalidDataApiBaseUrlError('/relative'),
    new InvalidDataApiResponseError(new Error('schema mismatch')),
    Object.assign(new Error('cancelled'), { name: 'AbortError' }),
  ])('does not retry local errors or cancellation', (error) => {
    expect(transactionHistoryRetry(0, error)).toBe(false)
  })

  it('does not retry a rejected chainIds filter', () => {
    expect(
      transactionHistoryRetry(0, new TypeError('chainIds must not be empty')),
    ).toBe(false)
  })

  it('does not mistake an unknown implementation error for a network failure', () => {
    expect(
      transactionHistoryRetry(0, new Error('wallet not initialized')),
    ).toBe(false)
  })
})
