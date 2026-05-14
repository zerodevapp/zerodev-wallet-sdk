import { describe, expect, it } from 'vitest'
import {
  generateOAuthNonce,
  OAUTH_PROVIDERS,
  verifyGoogleLoginUrl,
} from './verifyGoogleLoginUrl.js'

describe('OAUTH_PROVIDERS', () => {
  it('has google provider', () => {
    expect(OAUTH_PROVIDERS.GOOGLE).toBe('google')
  })
})

describe('generateOAuthNonce', () => {
  it('generates consistent nonce from public key', () => {
    const publicKey = '0x1234567890abcdef'

    const nonce1 = generateOAuthNonce(publicKey)
    const nonce2 = generateOAuthNonce(publicKey)

    expect(nonce1).toBe(nonce2)
  })

  it('returns nonce without 0x prefix', () => {
    const publicKey =
      '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'

    const nonce = generateOAuthNonce(publicKey)

    expect(nonce).not.toMatch(/^0x/)
  })

  it('generates different nonces for different keys', () => {
    const key1 =
      '0x1111111111111111111111111111111111111111111111111111111111111111'
    const key2 =
      '0x2222222222222222222222222222222222222222222222222222222222222222'

    const nonce1 = generateOAuthNonce(key1)
    const nonce2 = generateOAuthNonce(key2)

    expect(nonce1).not.toBe(nonce2)
  })

  it('hashes the UTF-8 ASCII bytes of the hex string (matches backend)', () => {
    // Locks the encoding: must SHA-256 the ASCII bytes of the hex string,
    // NOT the decoded pubkey bytes. Backend computes the same way:
    //   sha256.Sum256([]byte(pubKey.Marshal()))   // Go
    // Reference value via `printf 'abcdef' | sha256sum`:
    //   bef57ec7f53a6d40beb640a780a639c83bc29ac8a9816f1fc6c5c6dcd93c4721
    expect(generateOAuthNonce('0xabcdef')).toBe(
      'bef57ec7f53a6d40beb640a780a639c83bc29ac8a9816f1fc6c5c6dcd93c4721',
    )
    expect(generateOAuthNonce('abcdef')).toBe(
      'bef57ec7f53a6d40beb640a780a639c83bc29ac8a9816f1fc6c5c6dcd93c4721',
    )
  })

  it('lower-cases the hex before hashing', () => {
    expect(generateOAuthNonce('ABCDEF')).toBe(generateOAuthNonce('abcdef'))
  })
})

describe('verifyGoogleLoginUrl', () => {
  const publicKey = '0xabcdef'
  const validNonce = generateOAuthNonce(publicKey)

  it('passes when host is accounts.google.com and nonce matches', () => {
    const url = `https://accounts.google.com/o/oauth2/v2/auth?nonce=${validNonce}&client_id=x`
    expect(() => verifyGoogleLoginUrl(url, publicKey)).not.toThrow()
  })

  it('accepts uppercase nonce (case-insensitive comparison)', () => {
    const url = `https://accounts.google.com/o/oauth2/v2/auth?nonce=${validNonce.toUpperCase()}`
    expect(() => verifyGoogleLoginUrl(url, publicKey)).not.toThrow()
  })

  it('throws when nonce mismatches', () => {
    const url = `https://accounts.google.com/o/oauth2/v2/auth?nonce=${'0'.repeat(64)}`
    expect(() => verifyGoogleLoginUrl(url, publicKey)).toThrow(
      /nonce does not match public key hash/,
    )
  })

  it('throws when nonce is missing', () => {
    const url = 'https://accounts.google.com/o/oauth2/v2/auth?client_id=x'
    expect(() => verifyGoogleLoginUrl(url, publicKey)).toThrow(/missing nonce/)
  })

  it('throws when host is not accounts.google.com', () => {
    const url = `https://attacker.example.com/auth?nonce=${validNonce}`
    expect(() => verifyGoogleLoginUrl(url, publicKey)).toThrow(/host mismatch/)
  })

  it('throws on malformed URL', () => {
    expect(() => verifyGoogleLoginUrl('not a url', publicKey)).toThrow(
      /not a valid URL/,
    )
  })
})
