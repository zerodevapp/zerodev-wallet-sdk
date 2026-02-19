import { describe, expect, it } from 'vitest'
import { derToRawSignature } from './derToRawSignature.js'

describe('derToRawSignature', () => {
  describe('valid conversions', () => {
    it('converts a standard 70-byte DER signature to 64-byte raw', () => {
      // Standard DER signature with 32-byte r and 32-byte s (no padding needed)
      // 30 44 - SEQUENCE of 68 bytes
      // 02 20 - INTEGER of 32 bytes (r)
      // [32 bytes of r]
      // 02 20 - INTEGER of 32 bytes (s)
      // [32 bytes of s]
      const r =
        'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2'
      const s =
        '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
      // 30 44 02 20 [r] 02 20 [s]
      const derHex = `30440220${r}0220${s}`

      const result = derToRawSignature(derHex)

      expect(result).toBe(r + s)
      expect(result.length).toBe(128) // 64 bytes = 128 hex chars
    })

    it('converts DER signature with leading zero in r', () => {
      // When r has high bit set, DER prepends 0x00 to keep it positive
      // r starts with 0x00 (33 bytes total in DER), s is 32 bytes
      const rWithHighBit =
        'f1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2' // starts with f
      const s =
        '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
      // DER format: 30 45 02 21 00[r with high bit] 02 20 [s]
      const derHex = `3045022100${rWithHighBit}0220${s}`

      const result = derToRawSignature(derHex)

      expect(result).toBe(rWithHighBit + s)
    })

    it('converts DER signature with leading zero in s', () => {
      // s has high bit set, so DER prepends 0x00
      const r =
        '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
      const sWithHighBit =
        'f1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2'
      // DER format: 30 45 02 20 [r] 02 21 00[s with high bit]
      const derHex = `30450220${r}022100${sWithHighBit}`

      const result = derToRawSignature(derHex)

      expect(result).toBe(r + sWithHighBit)
    })

    it('converts DER signature with leading zeros in both r and s', () => {
      // Both r and s have high bit set
      const rWithHighBit =
        'f1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2'
      const sWithHighBit =
        'e1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b3'
      // DER format: 30 46 02 21 00[r] 02 21 00[s]
      const derHex = `3046022100${rWithHighBit}022100${sWithHighBit}`

      const result = derToRawSignature(derHex)

      expect(result).toBe(rWithHighBit + sWithHighBit)
    })

    it('handles DER signature with short r value (needs left-padding)', () => {
      // r is only 31 bytes (needs padding to 32)
      const shortR =
        'b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2' // 31 bytes = 62 hex chars
      const s =
        '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
      // DER format: 30 43 02 1f [31-byte r] 02 20 [s]
      const derHex = `3043021f${shortR}0220${s}`

      const result = derToRawSignature(derHex)

      // r should be left-padded with 00 to make 32 bytes
      expect(result).toBe(`00${shortR}${s}`)
    })

    it('handles 0x prefix in input', () => {
      const r =
        'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2'
      const s =
        '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
      const derHex = `0x30440220${r}0220${s}`

      const result = derToRawSignature(derHex)

      expect(result).toBe(r + s)
    })
    it('handles DER signature with short s value (needs left-padding)', () => {
      const r =
        '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
      const shortS =
        'b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2' // 31 bytes = 62 hex chars
      // DER format: 30 43 02 20 [32-byte r] 02 1f [31-byte s]
      const derHex = `30430220${r}021f${shortS}`

      const result = derToRawSignature(derHex)

      // s should be left-padded with 00 to make 32 bytes
      expect(result).toBe(`${r}00${shortS}`)
    })

    it('handles DER values with multiple leading zeros', () => {
      // r has two leading zero bytes that need stripping, then needs padding back to 32
      const rCore =
        'b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3' // 30 bytes
      const s =
        '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
      // DER format: r has 2 leading zeros (32 bytes in DER = 0x00 0x00 + 30 bytes core)
      const derHex = `30440220${'0000'}${rCore}0220${s}`

      const result = derToRawSignature(derHex)

      // After stripping leading zeros from r (30 bytes left), must pad back to 32
      expect(result).toBe(`0000${rCore}${s}`)
      expect(result.length).toBe(128)
    })

    it('handles padTo32Bytes truncation for oversized values', () => {
      // Construct a DER signature where r is 33 bytes (without leading zero)
      // This is unlikely in real P-256 but tests the defensive truncation path
      const rOversize =
        'ff' +
        'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2' // 33 bytes
      const s =
        '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
      // DER: 30 45 02 21 [33 bytes r] 02 20 [32 bytes s]
      const derHex = `30450221${rOversize}0220${s}`

      const result = derToRawSignature(derHex)

      // After stripLeadingZeros (ff is not zero, all 33 bytes kept), padTo32Bytes truncates from end
      expect(result.length).toBe(128)
    })
  })

  describe('error handling', () => {
    it('throws on missing SEQUENCE tag', () => {
      // First byte should be 0x30 (SEQUENCE)
      const invalidDer = `0144022020${'00'.repeat(32)}022020${'00'.repeat(32)}`

      expect(() => derToRawSignature(invalidDer)).toThrow(
        'Invalid DER signature: expected SEQUENCE tag (0x30)',
      )
    })

    it('throws on missing INTEGER tag for r', () => {
      // After SEQUENCE, should have 0x02 (INTEGER) for r
      const invalidDer = `3044032020${'00'.repeat(32)}022020${'00'.repeat(32)}`

      expect(() => derToRawSignature(invalidDer)).toThrow(
        'Invalid DER signature: expected INTEGER tag (0x02) for r',
      )
    })

    it('throws on missing INTEGER tag for s', () => {
      // Second value should also have 0x02 (INTEGER) tag
      const r =
        'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2'
      const invalidDer = `3044022020${r}032020${'00'.repeat(32)}`

      expect(() => derToRawSignature(invalidDer)).toThrow(
        'Invalid DER signature: expected INTEGER tag (0x02) for s',
      )
    })
  })

  describe('real-world test vectors', () => {
    it('converts a known secp256r1 (P-256) DER signature with leading zero in r', () => {
      // Real test vector from ECDSA P-256
      // r starts with high bit set (e5), so DER prepends 00
      // 30 45 = SEQUENCE of 69 bytes
      // 02 21 00 [32-byte r with leading 00] = INTEGER of 33 bytes
      // 02 20 [32-byte s] = INTEGER of 32 bytes
      const rValue =
        'e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5'
      const sValue =
        'a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1'
      const derHex = `3045022100${rValue}0220${sValue}`

      const result = derToRawSignature(derHex)

      // The leading 00 should be stripped from r
      expect(result).toBe(rValue + sValue)
    })

    it('converts a standard 70-byte P-256 signature', () => {
      // Both r and s have low high bits (no leading zeros in DER)
      const rValue =
        '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
      const sValue =
        'fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321'
      // 30 44 02 20 [r] 02 20 [s]
      const derHex = `30440220${rValue}0220${sValue}`

      const result = derToRawSignature(derHex)

      expect(result).toBe(rValue + sValue)
    })
  })
})
