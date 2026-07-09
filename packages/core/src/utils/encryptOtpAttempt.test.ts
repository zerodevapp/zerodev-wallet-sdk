import { p256 } from '@noble/curves/nist.js'
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js'
import { describe, expect, it } from 'vitest'
import { encryptOtpAttempt } from './encryptOtpAttempt.js'

/**
 * Build a v1 encryption target bundle signed by `signerSk`. Returns the JSON
 * envelope as a string plus the (uncompressed) HPKE target pubkey hex —
 * the latter so tests can decrypt and verify if they want to (we don't,
 * but exposing it makes the helper less magical).
 */
function buildBundle({
  signerSk,
  signerPubHex,
  targetPublicHex,
  organizationId = 'test-org',
  version = 'v1.0.0',
  tamperSignature = false,
  tamperData = false,
}: {
  signerSk: Uint8Array
  signerPubHex: string
  targetPublicHex: string
  organizationId?: string
  version?: string
  tamperSignature?: boolean
  tamperData?: boolean
}): string {
  const signedData = JSON.stringify({
    targetPublic: targetPublicHex,
    organizationId,
    userId: '',
  })
  const dataBytes = new TextEncoder().encode(signedData)
  const dataHex = bytesToHex(tamperData ? flipFirstByte(dataBytes) : dataBytes)

  const sigBytes = p256.sign(dataBytes, signerSk, {
    prehash: true,
    format: 'der',
    lowS: false,
  })
  const dataSignature = bytesToHex(
    tamperSignature ? flipFirstByte(sigBytes) : sigBytes,
  )

  return JSON.stringify({
    version,
    data: dataHex,
    dataSignature,
    enclaveQuorumPublic: signerPubHex,
  })
}

function flipFirstByte(b: Uint8Array): Uint8Array {
  const out = new Uint8Array(b)
  out[0] ^= 0x01
  return out
}

async function generateTargetPubHex(): Promise<string> {
  const pair = (await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits'],
  )) as CryptoKeyPair
  const raw = new Uint8Array(
    await crypto.subtle.exportKey('raw', pair.publicKey),
  )
  return bytesToHex(raw)
}

describe('encryptOtpAttempt', () => {
  it('produces a valid clientSendMsg for a well-formed bundle', async () => {
    const { secretKey: signerSk } = p256.keygen()
    const signerPubHex = bytesToHex(p256.getPublicKey(signerSk, false))

    const targetPublicHex = await generateTargetPubHex()
    const bundle = buildBundle({
      signerSk,
      signerPubHex,
      targetPublicHex,
    })

    const out = await encryptOtpAttempt({
      otpCode: '123456',
      publicKey:
        '02aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899',
      encryptionTargetBundle: bundle,
      dangerouslyOverrideSignerPublicKey: signerPubHex,
    })

    const parsed = JSON.parse(out)
    expect(typeof parsed.encappedPublic).toBe('string')
    expect(typeof parsed.ciphertext).toBe('string')

    // encappedPublic = uncompressed P-256 = 65 bytes = 130 hex chars, leading 04
    expect(parsed.encappedPublic.length).toBe(130)
    expect(parsed.encappedPublic.slice(0, 2)).toBe('04')

    // ciphertext = plaintext + 16-byte AES-GCM tag. Plaintext is JSON of
    // { otp_code, public_key }; we don't pin the exact length but it must be
    // at least 16 (tag-only) and divisible by 2 hex chars.
    expect(hexToBytes(parsed.ciphertext).length).toBeGreaterThan(16)
  })

  it('rejects a bundle whose enclaveQuorumPublic does not match the pinned key', async () => {
    const { secretKey: signerSk } = p256.keygen()
    const signerPubHex = bytesToHex(p256.getPublicKey(signerSk, false))
    const targetPublicHex = await generateTargetPubHex()
    const bundle = buildBundle({ signerSk, signerPubHex, targetPublicHex })

    // Override with a different pubkey to simulate the real pinned key not
    // matching the bundle's claimed quorum key.
    const { secretKey: otherSk } = p256.keygen()
    const otherPubHex = bytesToHex(p256.getPublicKey(otherSk, false))

    await expect(
      encryptOtpAttempt({
        otpCode: '123456',
        publicKey: '02aa',
        encryptionTargetBundle: bundle,
        dangerouslyOverrideSignerPublicKey: otherPubHex,
      }),
    ).rejects.toThrow(/does not match pinned signing key/)
  })

  it('rejects a tampered signature', async () => {
    const { secretKey: signerSk } = p256.keygen()
    const signerPubHex = bytesToHex(p256.getPublicKey(signerSk, false))
    const targetPublicHex = await generateTargetPubHex()
    const bundle = buildBundle({
      signerSk,
      signerPubHex,
      targetPublicHex,
      tamperSignature: true,
    })

    await expect(
      encryptOtpAttempt({
        otpCode: '123456',
        publicKey: '02aa',
        encryptionTargetBundle: bundle,
        dangerouslyOverrideSignerPublicKey: signerPubHex,
      }),
    ).rejects.toThrow(/invalid enclave signature/)
  })

  it('rejects a tampered data field (signature still over original)', async () => {
    const { secretKey: signerSk } = p256.keygen()
    const signerPubHex = bytesToHex(p256.getPublicKey(signerSk, false))
    const targetPublicHex = await generateTargetPubHex()
    const bundle = buildBundle({
      signerSk,
      signerPubHex,
      targetPublicHex,
      tamperData: true,
    })

    await expect(
      encryptOtpAttempt({
        otpCode: '123456',
        publicKey: '02aa',
        encryptionTargetBundle: bundle,
        dangerouslyOverrideSignerPublicKey: signerPubHex,
      }),
    ).rejects.toThrow(/invalid enclave signature/)
  })

  it('rejects an unsupported bundle version', async () => {
    const { secretKey: signerSk } = p256.keygen()
    const signerPubHex = bytesToHex(p256.getPublicKey(signerSk, false))
    const targetPublicHex = await generateTargetPubHex()
    const bundle = buildBundle({
      signerSk,
      signerPubHex,
      targetPublicHex,
      version: 'v2.0.0',
    })

    await expect(
      encryptOtpAttempt({
        otpCode: '123456',
        publicKey: '02aa',
        encryptionTargetBundle: bundle,
        dangerouslyOverrideSignerPublicKey: signerPubHex,
      }),
    ).rejects.toThrow(/unsupported bundle version/)
  })

  it('rejects malformed JSON bundle', async () => {
    await expect(
      encryptOtpAttempt({
        otpCode: '123456',
        publicKey: '02aa',
        encryptionTargetBundle: 'not json',
        dangerouslyOverrideSignerPublicKey: '04aa',
      }),
    ).rejects.toThrow(/failed to parse encryption target bundle/)
  })

  it('enforces the production pinned key when dangerouslyOverrideSignerPublicKey is not provided', async () => {
    // Build a bundle signed by a fresh, ephemeral test key — NOT the real
    // TURNKEY_TLS_FETCHER_SIGN_PUBLIC_KEY. Without the override, the function
    // must reject any bundle whose enclaveQuorumPublic doesn't match the
    // production pinned key, protecting integrators who omit the option.
    const { secretKey: signerSk } = p256.keygen()
    const signerPubHex = bytesToHex(p256.getPublicKey(signerSk, false))
    const targetPublicHex = await generateTargetPubHex()
    const bundle = buildBundle({ signerSk, signerPubHex, targetPublicHex })

    await expect(
      encryptOtpAttempt({
        otpCode: '123456',
        publicKey:
          '02aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899',
        encryptionTargetBundle: bundle,
        // dangerouslyOverrideSignerPublicKey intentionally omitted
      }),
    ).rejects.toThrow(/does not match pinned signing key/)
  })
})
