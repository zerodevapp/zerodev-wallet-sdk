import { describe, expect, it, vi } from 'vitest'
import type { ApiKeyStamper } from '../stampers/types.js'
import { buildClientSignature } from './buildClientSignature.js'

// Helper to create base64url encoded string
function base64UrlEncode(str: string): string {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

// Helper to create a JWT with specific payload
function createTestJwt(payload: Record<string, unknown>): string {
  const header = base64UrlEncode(JSON.stringify({ alg: 'ES256', typ: 'JWT' }))
  const payloadEncoded = base64UrlEncode(JSON.stringify(payload))
  const signature = base64UrlEncode('test-signature')
  return `${header}.${payloadEncoded}.${signature}`
}

// Create a valid DER signature hex
// Format: 30 44 02 20 [r 32 bytes] 02 20 [s 32 bytes]
function createValidDerSignature(): string {
  const r = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2'
  const s = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
  return `30440220${r}0220${s}`
}

// Create a mock stamper
function createMockStamper(
  signatureHex: string = createValidDerSignature(),
): ApiKeyStamper {
  return {
    stamp: vi.fn().mockResolvedValue({
      stampHeaderName: 'X-Stamp',
      stampHeaderValue: base64UrlEncode(
        JSON.stringify({ signature: signatureHex }),
      ),
    }),
    getPublicKey: vi.fn().mockResolvedValue('mock-public-key'),
    clear: vi.fn().mockResolvedValue(undefined),
    resetKeyPair: vi.fn().mockResolvedValue(undefined),
    prepareKeyRotation: vi.fn().mockResolvedValue('mock-public-key'),
    commitKeyRotation: vi.fn().mockResolvedValue(undefined),
  }
}

describe('buildClientSignature', () => {
  describe('successful signature building', () => {
    it('extracts tokenId from JWT and signs the payload, returning raw signature', async () => {
      const tokenId = 'test-token-id-123'
      const publicKey =
        '02abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab'
      const verificationToken = createTestJwt({
        id: tokenId,
        exp: Date.now() + 3600000,
      })
      const r =
        'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2'
      const s =
        '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
      const stamper = createMockStamper(`30440220${r}0220${s}`)

      const result = await buildClientSignature({
        verificationToken,
        publicKey,
        stamper,
      })

      // Verify the stamper was called with correct message
      expect(stamper.stamp).toHaveBeenCalledOnce()
      const stampedMessage = JSON.parse(
        (stamper.stamp as ReturnType<typeof vi.fn>).mock.calls[0][0],
      )
      expect(stampedMessage).toEqual({
        login: { publicKey },
        tokenId,
        type: 'USAGE_TYPE_LOGIN',
      })
      // Verify the return value is the raw r||s signature
      expect(result).toBe(r + s)
      expect(result.length).toBe(128)
    })

    it('returns raw signature from DER format', async () => {
      const tokenId = 'test-token-id'
      const publicKey = `03${'ab'.repeat(32)}`
      const verificationToken = createTestJwt({ id: tokenId })

      // Create a valid DER signature that will be returned by the stamper
      // Format: 30 44 02 20 [r] 02 20 [s]
      const r =
        'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2'
      const s =
        '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
      const derSignature = `30440220${r}0220${s}`
      const stamper = createMockStamper(derSignature)

      const result = await buildClientSignature({
        verificationToken,
        publicKey,
        stamper,
      })

      expect(result).toBe(r + s)
      expect(result.length).toBe(128) // 64 bytes = 128 hex chars
    })
  })

  describe('error handling', () => {
    it('throws on invalid JWT format (not 3 parts)', async () => {
      const invalidJwt = 'header.payload' // missing signature part
      const stamper = createMockStamper()

      await expect(
        buildClientSignature({
          verificationToken: invalidJwt,
          publicKey: `03${'ab'.repeat(32)}`,
          stamper,
        }),
      ).rejects.toThrow('Invalid JWT format')
    })

    it('throws on JWT missing id field', async () => {
      const jwtWithoutId = createTestJwt({
        exp: Date.now() + 3600000,
        sub: 'user123',
      })
      const stamper = createMockStamper()

      await expect(
        buildClientSignature({
          verificationToken: jwtWithoutId,
          publicKey: `03${'ab'.repeat(32)}`,
          stamper,
        }),
      ).rejects.toThrow('JWT payload missing id field')
    })

    it('throws on JWT with empty string id (falsy value)', async () => {
      const jwtWithEmptyId = createTestJwt({ id: '' })
      const stamper = createMockStamper()

      await expect(
        buildClientSignature({
          verificationToken: jwtWithEmptyId,
          publicKey: `03${'ab'.repeat(32)}`,
          stamper,
        }),
      ).rejects.toThrow('JWT payload missing id field')
    })

    it('throws on JWT with id: 0 (falsy value)', async () => {
      const jwtWithZeroId = createTestJwt({ id: 0 })
      const stamper = createMockStamper()

      await expect(
        buildClientSignature({
          verificationToken: jwtWithZeroId,
          publicKey: `03${'ab'.repeat(32)}`,
          stamper,
        }),
      ).rejects.toThrow('JWT payload missing id field')
    })

    it('throws when stamper fails', async () => {
      const verificationToken = createTestJwt({ id: 'token-123' })
      const stamper = createMockStamper()
      vi.mocked(stamper.stamp).mockRejectedValue(new Error('Stamper error'))

      await expect(
        buildClientSignature({
          verificationToken,
          publicKey: `03${'ab'.repeat(32)}`,
          stamper,
        }),
      ).rejects.toThrow('Stamper error')
    })
  })

  describe('base64url decoding', () => {
    it('handles JWT with padding-needed base64url', async () => {
      // Create a JWT where payload needs padding when decoded
      const tokenId = 'a' // Short id creates payload that needs padding
      const verificationToken = createTestJwt({ id: tokenId })
      const stamper = createMockStamper()

      await buildClientSignature({
        verificationToken,
        publicKey: `03${'ab'.repeat(32)}`,
        stamper,
      })

      const stampedMessage = JSON.parse(
        (stamper.stamp as ReturnType<typeof vi.fn>).mock.calls[0][0],
      )
      expect(stampedMessage.tokenId).toBe(tokenId)
    })

    it('handles JWT with special base64url characters', async () => {
      // Token ID with characters that would be + or / in base64
      const tokenId = 'test+token/id==' // Will be encoded differently
      const verificationToken = createTestJwt({ id: tokenId })
      const stamper = createMockStamper()

      await buildClientSignature({
        verificationToken,
        publicKey: `03${'ab'.repeat(32)}`,
        stamper,
      })

      const stampedMessage = JSON.parse(
        (stamper.stamp as ReturnType<typeof vi.fn>).mock.calls[0][0],
      )
      expect(stampedMessage.tokenId).toBe(tokenId)
    })
  })
})
