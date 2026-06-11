import { describe, expect, it, vi } from 'vitest'
import {
  base64UrlEncode,
  generateCompressedPublicKeyFromKeyPair,
  generateRandomBuffer,
  humanReadableDateTime,
  normalizeTimestamp,
  parseSession,
  pointEncode,
  uint8ArrayToHexString,
} from './utils.js'

// Helper to create base64-encoded JWT payload
function createJwtPayload(payload: Record<string, unknown>): string {
  const payloadEncoded = Buffer.from(JSON.stringify(payload)).toString('base64')
  return `header.${payloadEncoded}.signature`
}

describe('parseSession', () => {
  it('parses a valid JWT into session object', () => {
    const payload = {
      exp: 1700000000,
      public_key: 'test-public-key',
      session_type: 'SESSION_TYPE_READ_WRITE',
      user_id: 'user-123',
      organization_id: 'org-456',
    }
    const jwt = createJwtPayload(payload)

    const result = parseSession(jwt)

    expect(result).toEqual({
      sessionType: 'SESSION_TYPE_READ_WRITE',
      userId: 'user-123',
      organizationId: 'org-456',
      expiry: 1700000000,
      token: 'test-public-key',
    })
  })

  it('returns session object as-is if not a string', () => {
    const session = {
      id: 'session-id',
      userId: 'user-123',
      organizationId: 'org-456',
      stamperType: 'apiKey' as const,
      expiry: 1700000000,
      createdAt: 1699900000,
      token: 'test-public-key',
    }

    const result = parseSession(session)

    expect(result).toBe(session)
  })

  it('throws on invalid JWT missing payload', () => {
    const invalidJwt = 'header'

    expect(() => parseSession(invalidJwt)).toThrow(
      'Invalid JWT: Missing payload',
    )
  })

  it('throws on JWT missing required fields', () => {
    const payload = {
      exp: 1700000000,
      // missing public_key, session_type, user_id, organization_id
    }
    const jwt = createJwtPayload(payload)

    expect(() => parseSession(jwt)).toThrow(
      'JWT payload missing required fields',
    )
  })

  it('throws on malformed base64 payload (non-JSON)', () => {
    // base64 of "not-json" = "bm90LWpzb24="
    const jwt = 'header.bm90LWpzb24.signature'

    expect(() => parseSession(jwt)).toThrow()
  })

  it('throws when only some required fields are present', () => {
    const payload = {
      exp: 1700000000,
      public_key: 'key',
      // missing session_type, user_id, organization_id
    }
    const jwt = createJwtPayload(payload)

    expect(() => parseSession(jwt)).toThrow(
      'JWT payload missing required fields',
    )
  })

  it('throws when exp is missing', () => {
    const payload = {
      public_key: 'key',
      session_type: 'SESSION_TYPE_READ_WRITE',
      user_id: 'user',
      organization_id: 'org',
      // missing exp
    }
    const jwt = createJwtPayload(payload)

    expect(() => parseSession(jwt)).toThrow(
      'JWT payload missing required fields',
    )
  })
})

describe('normalizeTimestamp', () => {
  it('converts seconds to milliseconds when value is small', () => {
    const secondsTimestamp = 1700000000 // Less than 1e10

    const result = normalizeTimestamp(secondsTimestamp)

    expect(result).toBe(1700000000000) // Converted to ms
  })

  it('keeps milliseconds timestamp unchanged', () => {
    const msTimestamp = 1700000000000 // Greater than 1e10

    const result = normalizeTimestamp(msTimestamp)

    expect(result).toBe(1700000000000)
  })

  it('handles boundary value (exactly 1e10)', () => {
    const boundaryValue = 10000000000 // Exactly 1e10 (year ~2286 in seconds)

    const result = normalizeTimestamp(boundaryValue)

    // 1e10 is NOT less than 1e10, so it's treated as milliseconds
    expect(result).toBe(10000000000)
  })

  it('handles zero', () => {
    const result = normalizeTimestamp(0)

    expect(result).toBe(0)
  })

  it('treats negative values as seconds (multiplied by 1000)', () => {
    const result = normalizeTimestamp(-1)

    // -1 < 1e10, so it's multiplied by 1000
    expect(result).toBe(-1000)
  })
})

describe('generateRandomBuffer', () => {
  it('returns an ArrayBuffer of 32 bytes', () => {
    const buffer = generateRandomBuffer()

    expect(buffer).toBeInstanceOf(ArrayBuffer)
    expect(buffer.byteLength).toBe(32)
  })

  it('returns different values on each call', () => {
    const buffer1 = generateRandomBuffer()
    const buffer2 = generateRandomBuffer()

    const arr1 = new Uint8Array(buffer1)
    const arr2 = new Uint8Array(buffer2)

    // Very unlikely to be equal (2^256 possibilities)
    expect(arr1).not.toEqual(arr2)
  })
})

describe('base64UrlEncode', () => {
  it('encodes ArrayBuffer to base64url string', () => {
    const data = new Uint8Array([72, 101, 108, 108, 111]) // "Hello"
    const buffer = data.buffer

    const result = base64UrlEncode(buffer)

    expect(result).toBe('SGVsbG8')
    // Standard base64 would be "SGVsbG8="
    // base64url removes padding
  })

  it('replaces + with - and / with _', () => {
    // Create data that would have + and / in standard base64
    // 0xfb, 0xef, 0xbe -> base64 "++--" would have special chars
    const data = new Uint8Array([251, 239, 190])
    const buffer = data.buffer

    const result = base64UrlEncode(buffer)

    expect(result).not.toContain('+')
    expect(result).not.toContain('/')
    expect(result).not.toContain('=')
  })

  it('handles empty buffer', () => {
    const buffer = new ArrayBuffer(0)

    const result = base64UrlEncode(buffer)

    expect(result).toBe('')
  })

  it('encodes large buffers without exceeding the argument limit', () => {
    const data = new Uint8Array(150_000)
    for (let i = 0; i < data.length; i++) {
      data[i] = i % 256
    }

    const result = base64UrlEncode(data.buffer)

    expect(result).toBe(Buffer.from(data).toString('base64url'))
  })
})

describe('pointEncode', () => {
  it('compresses uncompressed P-256 public key with even y', () => {
    // Create a valid uncompressed key (0x04 prefix + 32-byte x + 32-byte y)
    const raw = new Uint8Array(65)
    raw[0] = 0x04 // Uncompressed prefix
    // x coordinate (32 bytes)
    for (let i = 1; i <= 32; i++) {
      raw[i] = i
    }
    // y coordinate (32 bytes) - last byte is even
    for (let i = 33; i <= 64; i++) {
      raw[i] = i - 32
    }
    raw[64] = 0x02 // Even y coordinate

    const result = pointEncode(raw)

    expect(result.length).toBe(33)
    expect(result[0]).toBe(0x02) // Even y -> 0x02 prefix
    // Rest should be x coordinate
    expect(result.slice(1)).toEqual(raw.slice(1, 33))
  })

  it('compresses uncompressed P-256 public key with odd y', () => {
    const raw = new Uint8Array(65)
    raw[0] = 0x04
    for (let i = 1; i <= 32; i++) {
      raw[i] = i
    }
    for (let i = 33; i <= 64; i++) {
      raw[i] = i - 32
    }
    raw[64] = 0x03 // Odd y coordinate (last bit is 1)

    const result = pointEncode(raw)

    expect(result.length).toBe(33)
    expect(result[0]).toBe(0x03) // Odd y -> 0x03 prefix
  })

  it('throws on wrong length', () => {
    const raw = new Uint8Array(64) // Should be 65
    raw[0] = 0x04

    expect(() => pointEncode(raw)).toThrow('Invalid uncompressed P-256 key')
  })

  it('throws on wrong prefix', () => {
    const raw = new Uint8Array(65)
    raw[0] = 0x02 // Should be 0x04

    expect(() => pointEncode(raw)).toThrow('Invalid uncompressed P-256 key')
  })
})

describe('uint8ArrayToHexString', () => {
  it('converts bytes to lowercase hex string', () => {
    const input = new Uint8Array([0x00, 0x01, 0xff, 0xab, 0xcd])

    const result = uint8ArrayToHexString(input)

    expect(result).toBe('0001ffabcd')
  })

  it('handles empty array', () => {
    const input = new Uint8Array([])

    const result = uint8ArrayToHexString(input)

    expect(result).toBe('')
  })

  it('pads single-digit hex values with zero', () => {
    const input = new Uint8Array([0x0f, 0x00, 0x01])

    const result = uint8ArrayToHexString(input)

    expect(result).toBe('0f0001')
  })
})

describe('generateCompressedPublicKeyFromKeyPair', () => {
  // Helper to create a mock 65-byte uncompressed P-256 public key
  function createUncompressedKey(lastYByte: number): ArrayBuffer {
    const raw = new Uint8Array(65)
    raw[0] = 0x04
    for (let i = 1; i <= 32; i++) {
      raw[i] = i
    }
    for (let i = 33; i <= 64; i++) {
      raw[i] = i - 32
    }
    raw[64] = lastYByte
    return raw.buffer
  }

  it('returns compressed hex string from key pair with even y', async () => {
    const mockKeyPair = {
      publicKey: {} as CryptoKey,
      privateKey: {} as CryptoKey,
    }
    const rawBuffer = createUncompressedKey(0x02) // even y

    vi.spyOn(crypto.subtle, 'exportKey').mockResolvedValueOnce(rawBuffer)

    const result = await generateCompressedPublicKeyFromKeyPair(mockKeyPair)

    expect(crypto.subtle.exportKey).toHaveBeenCalledWith(
      'raw',
      mockKeyPair.publicKey,
    )
    // 33 bytes = 66 hex chars
    expect(result.length).toBe(66)
    // Even y -> 02 prefix
    expect(result.startsWith('02')).toBe(true)
  })

  it('returns compressed hex string from key pair with odd y', async () => {
    const mockKeyPair = {
      publicKey: {} as CryptoKey,
      privateKey: {} as CryptoKey,
    }
    const rawBuffer = createUncompressedKey(0x03) // odd y

    vi.spyOn(crypto.subtle, 'exportKey').mockResolvedValueOnce(rawBuffer)

    const result = await generateCompressedPublicKeyFromKeyPair(mockKeyPair)

    expect(result.length).toBe(66)
    // Odd y -> 03 prefix
    expect(result.startsWith('03')).toBe(true)
  })

  it('produces consistent output for same key', async () => {
    const mockKeyPair = {
      publicKey: {} as CryptoKey,
      privateKey: {} as CryptoKey,
    }
    const rawBuffer = createUncompressedKey(0x02)

    vi.spyOn(crypto.subtle, 'exportKey')
      .mockResolvedValueOnce(rawBuffer)
      .mockResolvedValueOnce(createUncompressedKey(0x02))

    const result1 = await generateCompressedPublicKeyFromKeyPair(mockKeyPair)
    const result2 = await generateCompressedPublicKeyFromKeyPair(mockKeyPair)

    expect(result1).toBe(result2)
  })

  it('propagates crypto.subtle.exportKey errors', async () => {
    const mockKeyPair = {
      publicKey: {} as CryptoKey,
      privateKey: {} as CryptoKey,
    }

    vi.spyOn(crypto.subtle, 'exportKey').mockRejectedValueOnce(
      new Error('Key not extractable'),
    )

    await expect(
      generateCompressedPublicKeyFromKeyPair(mockKeyPair),
    ).rejects.toThrow('Key not extractable')
  })
})

describe('humanReadableDateTime', () => {
  it('returns a formatted date time string', () => {
    // Mock Date to get consistent output
    const mockDate = new Date('2024-01-15T10:30:45')
    vi.setSystemTime(mockDate)

    const result = humanReadableDateTime()

    // The format depends on locale, but we can check it doesn't contain / or :
    expect(result).not.toContain('/')
    expect(result).not.toContain(':')

    vi.useRealTimers()
  })

  it('replaces / with - and : with .', () => {
    const mockDate = new Date('2024-12-25T23:59:59')
    vi.setSystemTime(mockDate)

    const result = humanReadableDateTime()

    expect(result).not.toContain('/')
    expect(result).not.toContain(':')

    vi.useRealTimers()
  })
})
