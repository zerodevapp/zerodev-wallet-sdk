import { describe, expect, it } from 'vitest'
import { isCancellationError } from './isCancellationError'

/** EIP-1193 ProviderRpcError: an Error subclass carrying `code`. */
class ProviderRpcError extends Error {
  code: number
  constructor(message: string, code: number) {
    super(message)
    this.code = code
  }
}

describe('isCancellationError', () => {
  describe('EIP-1193 4001 "user rejected"', () => {
    it("accepts a wallet's ProviderRpcError: an Error with code 4001 and a generic name", () => {
      // Regression: the Error / non-Error split used to skip the code check
      // for Error instances, so this reached the generic failure branch.
      const err = new ProviderRpcError('User rejected the request.', 4001)
      expect(err.name).toBe('Error')
      expect(isCancellationError(err)).toBe(true)
    })

    it("accepts the raw JSON-RPC object wagmi's injected connector rethrows", () => {
      expect(
        isCancellationError({
          code: 4001,
          message: 'User rejected the request.',
        }),
      ).toBe(true)
    })

    it("accepts viem's UserRejectedRequestError by name", () => {
      const err = new Error('User rejected the request.')
      err.name = 'UserRejectedRequestError'
      expect(isCancellationError(err)).toBe(true)
    })

    it('finds a 4001 nested under .cause', () => {
      const err = new Error('Connector error')
      ;(err as { cause?: unknown }).cause = new ProviderRpcError(
        'User rejected the request.',
        4001,
      )
      expect(isCancellationError(err)).toBe(true)
    })

    it('does not treat other RPC codes as cancellation', () => {
      expect(
        isCancellationError(new ProviderRpcError('already pending', -32002)),
      ).toBe(false)
      expect(isCancellationError({ code: -32603 })).toBe(false)
    })
  })

  it('accepts a dismissed passkey prompt', () => {
    for (const name of ['AbortError', 'NotAllowedError']) {
      const err = new Error('The operation was aborted.')
      err.name = name
      expect(isCancellationError(err)).toBe(true)
    }
  })

  it('accepts a closed OAuth popup', () => {
    expect(isCancellationError(new Error('OAuth popup was closed'))).toBe(true)
  })

  it('rejects ordinary failures and non-objects', () => {
    expect(isCancellationError(new Error('network down'))).toBe(false)
    expect(isCancellationError('User rejected')).toBe(false)
    expect(isCancellationError(null)).toBe(false)
    expect(isCancellationError(undefined)).toBe(false)
  })
})
