import { NotAuthenticatedError } from '@zerodev/wallet-react'
import { describe, expect, it } from 'vitest'
import {
  DataApiError,
  DataApiNetworkError,
  InvalidDataApiBaseUrlError,
  InvalidDataApiResponseError,
} from '../errors.js'
import {
  transactionHistoryRetry,
  transactionHistoryRetryDelay,
} from './query.js'

function dataApiError(status: number, retryAfterMs?: number) {
  return new DataApiError({
    status,
    body: { error: 'test' },
    url: 'https://data.example/v1/me/transaction-history',
    ...(retryAfterMs === undefined ? {} : { retryAfterMs }),
  })
}

describe('transactionHistoryRetry', () => {
  it.each([400, 401, 402, 403, 500, 503])(
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

  it('does not mistake an unknown implementation error for a network failure', () => {
    expect(
      transactionHistoryRetry(0, new Error('wallet not initialized')),
    ).toBe(false)
  })
})
