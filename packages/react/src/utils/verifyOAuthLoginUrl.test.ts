import { describe, expect, it } from 'vitest'
import {
  generateOAuthNonce,
  OAUTH_PROVIDERS,
  verifyGoogleLoginUrl,
  verifyOAuthLoginUrl,
  verifyXLoginUrl,
} from './verifyOAuthLoginUrl.js'

describe('OAUTH_PROVIDERS', () => {
  it('has google provider', () => {
    expect(OAUTH_PROVIDERS.GOOGLE).toBe('google')
  })
  it('has x provider', () => {
    expect(OAUTH_PROVIDERS.X).toBe('x')
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

describe('verifyXLoginUrl', () => {
  const pubKey = '03abcdef123'
  const nonce = generateOAuthNonce(pubKey)

  it('passes when host, path and nonce match', () => {
    expect(() =>
      verifyXLoginUrl(
        `https://x.com/i/oauth2/authorize?client_id=abc&nonce=${nonce}`,
        pubKey,
      ),
    ).not.toThrow()
  })

  it('throws on a malformed URL', () => {
    expect(() => verifyXLoginUrl('not a url', pubKey)).toThrow(/valid URL/)
  })

  it('throws when nonce is missing', () => {
    expect(() =>
      verifyXLoginUrl('https://x.com/i/oauth2/authorize?client_id=abc', pubKey),
    ).toThrow(/missing nonce/)
  })
})

describe('verifyOAuthLoginUrl', () => {
  const pubKey = '03abcdef123'
  const nonce = generateOAuthNonce(pubKey)

  it('delegates google to verifyGoogleLoginUrl', () => {
    expect(() =>
      verifyOAuthLoginUrl(
        'google',
        `https://accounts.google.com/o/oauth2/v2/auth?nonce=${nonce}`,
        pubKey,
      ),
    ).not.toThrow()
    expect(() =>
      verifyOAuthLoginUrl(
        'google',
        `https://x.com/i/oauth2/authorize?nonce=${nonce}`,
        pubKey,
      ),
    ).toThrow(/host mismatch/)
  })

  it('passes for x when host, path and nonce match', () => {
    expect(() =>
      verifyOAuthLoginUrl(
        'x',
        `https://x.com/i/oauth2/authorize?client_id=abc&nonce=${nonce}`,
        pubKey,
      ),
    ).not.toThrow()
  })

  it('rejects a google host under provider x', () => {
    expect(() =>
      verifyOAuthLoginUrl(
        'x',
        `https://accounts.google.com/o/oauth2/v2/auth?nonce=${nonce}`,
        pubKey,
      ),
    ).toThrow(/host mismatch/)
  })

  it('rejects an x host with the wrong path', () => {
    expect(() =>
      verifyOAuthLoginUrl('x', `https://x.com/login?nonce=${nonce}`, pubKey),
    ).toThrow(/path mismatch/)
  })

  it('rejects a nonce mismatch for x', () => {
    expect(() =>
      verifyOAuthLoginUrl(
        'x',
        'https://x.com/i/oauth2/authorize?nonce=deadbeef',
        pubKey,
      ),
    ).toThrow(/nonce does not match/)
  })
})
