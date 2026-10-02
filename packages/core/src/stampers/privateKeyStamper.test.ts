import { createPublicKey, createVerify, ECDH } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { createPrivateKeyStamper } from './privateKeyStamper.js'

// P-256 test key from RFC 6979, appendix A.2.5, and its published compressed public key.
const TEST_PRIVATE_KEY =
  'c9afa9d845ba75166b5c215767b1d6934e50c3db36e89b127b8a622b120f6721'
const TEST_PUBLIC_KEY =
  '0360fed4ba255a9d31c961eb74c6356d68c049b8923b61fa6ce669622e60f29fb6'
const TEST_SIGNATURE_DER =
  '3045022100f1abb023518351cd71d881567b1ea663ed3efcf6c5132b354f28d3b0b7d383670220019f4113742a2b14bd25926b49c649155f267e60d3814b4c0cc84250e46f0083'

/**
 * Mirrors `stampcheck.VerifyAPIKeyStamp` from the point the KMS holds a
 * canonical body: decompress the key, sha256 the bytes, check the DER
 * signature. Scheme and canonicalization are asserted by the callers.
 */
function verifySignature(
  compressedPublicKeyHex: string,
  signatureDerHex: string,
  payload: string,
): boolean {
  const point = Buffer.from(
    ECDH.convertKey(
      compressedPublicKeyHex,
      'prime256v1',
      'hex',
      'hex',
      'uncompressed',
    ) as string,
    'hex',
  )
  const key = createPublicKey({
    key: {
      kty: 'EC',
      crv: 'P-256',
      x: point.subarray(1, 33).toString('base64url'),
      y: point.subarray(33).toString('base64url'),
    },
    format: 'jwk',
  })
  return createVerify('SHA256')
    .update(payload)
    .verify(key, signatureDerHex, 'hex')
}

function decodeStamp(stampHeaderValue: string) {
  return JSON.parse(Buffer.from(stampHeaderValue, 'base64url').toString()) as {
    publicKey: string
    scheme: string
    signature: string
  }
}

describe('createPrivateKeyStamper', () => {
  const stamper = createPrivateKeyStamper(TEST_PRIVATE_KEY)

  it('stamps in the envelope the KMS parses and signs sha256 of the payload', async () => {
    const payload = '{"timestampMs":1700000000000}'

    const stamp = await stamper.stamp(payload)
    const envelope = decodeStamp(stamp.stampHeaderValue)

    expect(stamp.stampHeaderName).toBe('X-Stamp')
    expect(envelope).toEqual({
      publicKey: TEST_PUBLIC_KEY,
      scheme: 'SIGNATURE_SCHEME_TK_API_P256',
      signature: expect.stringMatching(/^30[0-9a-f]+$/),
    })
    expect(
      verifySignature(envelope.publicKey, envelope.signature, payload),
    ).toBe(true)
  })

  it('does not verify against a different payload', async () => {
    const stamp = await stamper.stamp('1700000000000')
    const envelope = decodeStamp(stamp.stampHeaderValue)

    expect(
      verifySignature(envelope.publicKey, envelope.signature, '1700000000001'),
    ).toBe(false)
  })

  it('sign() reproduces the published signature for "test"', async () => {
    // Equality holds because noble derives the nonce per RFC 6979 and
    // normalizes to low-s by default. A noble default change surfaces here.
    await expect(stamper.sign('test')).resolves.toBe(TEST_SIGNATURE_DER)
  })

  it('reports the compressed public key published for the key', async () => {
    await expect(stamper.getPublicKey()).resolves.toBe(TEST_PUBLIC_KEY)
  })

  it('accepts the private key with or without a 0x prefix', async () => {
    await expect(
      createPrivateKeyStamper(`0x${TEST_PRIVATE_KEY}`).getPublicKey(),
    ).resolves.toBe(TEST_PUBLIC_KEY)
  })

  it('throws at construction when the key is not 32 bytes', () => {
    expect(() => createPrivateKeyStamper('deadbeef')).toThrow()
  })
})
