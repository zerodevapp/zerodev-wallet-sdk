import { describe, expect, it } from 'vitest'
import { isClientError, shouldRetryRequest } from './query.js'

describe('isClientError', () => {
  it('is true for 4xx statuses', () => {
    expect(isClientError({ status: 400 })).toBe(true)
    expect(isClientError({ status: 401 })).toBe(true)
    expect(isClientError({ status: 403 })).toBe(true)
    expect(isClientError({ status: 499 })).toBe(true)
  })

  it('is false for 5xx, non-error statuses, and non-status errors', () => {
    expect(isClientError({ status: 500 })).toBe(false)
    expect(isClientError({ status: 200 })).toBe(false)
    expect(isClientError(new Error('network down'))).toBe(false)
    expect(isClientError(null)).toBe(false)
    expect(isClientError(undefined)).toBe(false)
    expect(isClientError({ status: '401' })).toBe(false)
  })
})

describe('shouldRetryRequest', () => {
  it('never retries a 4xx (expired/invalid session)', () => {
    expect(shouldRetryRequest(0, { status: 401 })).toBe(false)
    expect(shouldRetryRequest(5, { status: 403 })).toBe(false)
  })

  it('retries transient errors up to twice', () => {
    expect(shouldRetryRequest(0, { status: 503 })).toBe(true)
    expect(shouldRetryRequest(1, { status: 503 })).toBe(true)
    expect(shouldRetryRequest(2, { status: 503 })).toBe(false)
    expect(shouldRetryRequest(0, new Error('network'))).toBe(true)
  })
})
