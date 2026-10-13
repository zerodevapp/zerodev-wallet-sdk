import { describe, expect, it } from 'vitest'
import { errorMessage } from './errorMessage'

describe('errorMessage', () => {
  it('reads an Error', () => {
    expect(errorMessage(new Error('network down'))).toBe('network down')
  })

  it("reads WalletConnect's plain rejection object", () => {
    expect(errorMessage({ code: 5100, message: 'Unsupported chains.' })).toBe(
      'Unsupported chains.',
    )
  })

  it('falls back to String() for anything else', () => {
    expect(errorMessage('plain string')).toBe('plain string')
    expect(errorMessage(42)).toBe('42')
    expect(errorMessage(undefined)).toBe('undefined')
    // An object without a string message is still not "[object Object]"-worthy
    // input the kit expects, but must not throw.
    expect(errorMessage({ code: 1 })).toBe('[object Object]')
  })
})
