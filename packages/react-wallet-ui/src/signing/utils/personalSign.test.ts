import type { Hex } from 'viem'
import { stringToHex } from 'viem'
import { describe, expect, it } from 'vitest'
import { decodePersonalSignMessage } from './personalSign'

describe('decodePersonalSignMessage', () => {
  it('decodes a hex-encoded string', () => {
    const hex = stringToHex('Hello, world!')
    expect(decodePersonalSignMessage(hex)).toBe('Hello, world!')
  })

  it('decodes a multiline message', () => {
    const hex = stringToHex('Sign in to Example.com\n\nNonce: abc123')
    expect(decodePersonalSignMessage(hex)).toBe(
      'Sign in to Example.com\n\nNonce: abc123',
    )
  })

  it('returns null for malformed input', () => {
    const badHex = '0xgg' as Hex
    expect(decodePersonalSignMessage(badHex)).toBeNull()
  })
})
