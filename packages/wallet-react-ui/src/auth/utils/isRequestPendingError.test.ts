import { describe, expect, it } from 'vitest'
import { isRequestPendingError } from './isRequestPendingError'

describe('isRequestPendingError', () => {
  it("accepts the raw JSON-RPC object wagmi's injected connector rethrows", () => {
    expect(
      isRequestPendingError({
        code: -32002,
        message: 'Request of type wallet_requestPermissions already pending',
      }),
    ).toBe(true)
  })

  it("accepts viem's ResourceUnavailableRpcError by name", () => {
    const err = new Error('Resource unavailable.')
    err.name = 'ResourceUnavailableRpcError'
    expect(isRequestPendingError(err)).toBe(true)
  })

  it('accepts an Error carrying the code', () => {
    expect(
      isRequestPendingError(
        Object.assign(new Error('already pending'), {
          code: -32002,
        }),
      ),
    ).toBe(true)
  })

  it('finds it nested under .cause', () => {
    const err = new Error('Connector error')
    ;(err as { cause?: unknown }).cause = {
      code: -32002,
      message: 'already pending',
    }
    expect(isRequestPendingError(err)).toBe(true)
  })

  it('stops walking rather than looping on a cyclic cause', () => {
    const err: { cause?: unknown } = {}
    err.cause = err
    expect(isRequestPendingError(err)).toBe(false)
  })

  it('rejects other errors and non-objects', () => {
    expect(isRequestPendingError({ code: 4001 })).toBe(false)
    expect(isRequestPendingError(new Error('network down'))).toBe(false)
    expect(isRequestPendingError('already pending')).toBe(false)
    expect(isRequestPendingError(null)).toBe(false)
  })
})
