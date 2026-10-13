import { describe, expect, it } from 'vitest'
import { isResourceUnavailableError } from './isResourceUnavailableError'

describe('isResourceUnavailableError', () => {
  it("accepts the raw JSON-RPC object wagmi's injected connector rethrows", () => {
    expect(
      isResourceUnavailableError({
        code: -32002,
        message: 'Request of type wallet_requestPermissions already pending',
      }),
    ).toBe(true)
  })

  it("accepts viem's ResourceUnavailableRpcError by name", () => {
    const err = new Error('Resource unavailable.')
    err.name = 'ResourceUnavailableRpcError'
    expect(isResourceUnavailableError(err)).toBe(true)
  })

  it('accepts an Error carrying the code', () => {
    expect(
      isResourceUnavailableError(
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
    expect(isResourceUnavailableError(err)).toBe(true)
  })

  it('stops walking rather than looping on a cyclic cause', () => {
    const err: { cause?: unknown } = {}
    err.cause = err
    expect(isResourceUnavailableError(err)).toBe(false)
  })

  it('rejects other errors and non-objects', () => {
    expect(isResourceUnavailableError({ code: 4001 })).toBe(false)
    expect(isResourceUnavailableError(new Error('network down'))).toBe(false)
    expect(isResourceUnavailableError('already pending')).toBe(false)
    expect(isResourceUnavailableError(null)).toBe(false)
  })
})
