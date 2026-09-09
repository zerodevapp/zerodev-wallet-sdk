import { describe, expect, it } from 'vitest'
import { isRequestPendingError } from './isRequestPendingError'

describe('isRequestPendingError', () => {
  it('matches EIP-1193 -32002 by code', () => {
    expect(
      isRequestPendingError(
        Object.assign(new Error('pending'), { code: -32002 }),
      ),
    ).toBe(true)
  })

  it("matches viem's ResourceUnavailableRpcError by name", () => {
    const err = new Error('Resource unavailable')
    err.name = 'ResourceUnavailableRpcError'
    expect(isRequestPendingError(err)).toBe(true)
  })

  it('walks the cause chain wagmi wraps around the wallet error', () => {
    const inner = Object.assign(
      new Error('Request of type wallet_requestPermissions already pending'),
      { code: -32002 },
    )
    const outer = new Error('Connector error')
    ;(outer as { cause?: unknown }).cause = inner
    expect(isRequestPendingError(outer)).toBe(true)
  })

  it('is false for rejections and unrelated errors', () => {
    const rejection = new Error('User rejected the request.')
    rejection.name = 'UserRejectedRequestError'
    expect(isRequestPendingError(rejection)).toBe(false)
    expect(isRequestPendingError(new Error('boom'))).toBe(false)
    expect(isRequestPendingError('not an error')).toBe(false)
  })
})
