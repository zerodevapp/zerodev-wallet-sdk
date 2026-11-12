import { describe, expect, it } from 'vitest'
import { withSignature } from './transaction'

/** A minimal serialized transaction: `signers` empty signature slots, a
 * legacy or v0 message header naming them, then the given account keys. */
function fakeTransaction({
  keys,
  signers,
  versioned = false,
}: {
  keys: Uint8Array[]
  signers: number
  versioned?: boolean
}): Uint8Array {
  const parts: number[] = [signers]
  for (let i = 0; i < signers; i++) parts.push(...new Array(64).fill(0))
  if (versioned) parts.push(0x80)
  parts.push(signers, 0, 1) // header
  parts.push(keys.length)
  for (const key of keys) parts.push(...key)
  parts.push(...[1, 2, 3, 4]) // the rest of the message, untouched
  return new Uint8Array(parts)
}

const key = (fill: number) => new Uint8Array(32).fill(fill)
const sig = (fill: number) => new Uint8Array(64).fill(fill)

describe('withSignature', () => {
  it('writes the signature into the signer slot and leaves the rest alone', () => {
    const tx = fakeTransaction({ keys: [key(1), key(2), key(3)], signers: 2 })
    const signed = withSignature(tx, key(2), sig(9))
    expect(signed).not.toBe(tx)
    // Slot 0 (key 1) untouched, slot 1 (key 2) filled.
    expect(signed.subarray(1, 65).every((b) => b === 0)).toBe(true)
    expect(signed.subarray(65, 129).every((b) => b === 9)).toBe(true)
    // Message bytes identical.
    expect(signed.subarray(129)).toEqual(tx.subarray(129))
    expect(tx.subarray(65, 129).every((b) => b === 0)).toBe(true)
  })

  it('handles a versioned (v0) message', () => {
    const tx = fakeTransaction({ keys: [key(7)], signers: 1, versioned: true })
    const signed = withSignature(tx, key(7), sig(5))
    expect(signed.subarray(1, 65).every((b) => b === 5)).toBe(true)
    expect(signed[65]).toBe(0x80)
  })

  it('rejects a signer the transaction does not name', () => {
    const tx = fakeTransaction({ keys: [key(1), key(2)], signers: 1 })
    // key(2) is an account but not a required signer.
    expect(() => withSignature(tx, key(2), sig(1))).toThrow('not a signer')
    expect(() => withSignature(tx, key(4), sig(1))).toThrow('not a signer')
  })

  it('rejects malformed input', () => {
    const tx = fakeTransaction({ keys: [key(1)], signers: 1 })
    expect(() => withSignature(tx, key(1), new Uint8Array(10))).toThrow(
      '64 bytes',
    )
    expect(() => withSignature(tx, new Uint8Array(5), sig(1))).toThrow(
      '32 bytes',
    )
    expect(() => withSignature(new Uint8Array([1]), key(1), sig(1))).toThrow(
      'truncated',
    )
  })
})
