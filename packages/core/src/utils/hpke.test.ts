import {
  Aes256Gcm,
  CipherSuite,
  DhkemP256HkdfSha256,
  HkdfSha256,
} from '@hpke/core'
import { describe, expect, it } from 'vitest'
import { hpkeSealP256 } from './hpke.js'

const TURNKEY_HPKE_INFO = new TextEncoder().encode('turnkey_hpke')

/**
 * Reference round-trip helper: opens a Turnkey-style sealed payload using
 * `@hpke/core`. The AAD shape (`enc || pkR`) and info string match what
 * `hpkeSealP256` produces and what `enclave_encrypt.EnclaveEncryptServer`
 * expects on the Go side.
 */
async function openWithHpkeCore({
  recipientKey, // CryptoKeyPair, P-256
  recipientPubRaw, // 65-byte uncompressed P-256 pubkey
  encappedPublic,
  ciphertext,
}: {
  recipientKey: CryptoKeyPair
  recipientPubRaw: Uint8Array
  encappedPublic: Uint8Array
  ciphertext: Uint8Array
}): Promise<Uint8Array> {
  const suite = new CipherSuite({
    kem: new DhkemP256HkdfSha256(),
    kdf: new HkdfSha256(),
    aead: new Aes256Gcm(),
  })
  const recipient = await suite.createRecipientContext({
    recipientKey: recipientKey.privateKey,
    enc: encappedPublic.buffer.slice(
      encappedPublic.byteOffset,
      encappedPublic.byteOffset + encappedPublic.byteLength,
    ),
    info: TURNKEY_HPKE_INFO.buffer.slice(
      TURNKEY_HPKE_INFO.byteOffset,
      TURNKEY_HPKE_INFO.byteOffset + TURNKEY_HPKE_INFO.byteLength,
    ),
  })

  const aad = new Uint8Array(encappedPublic.length + recipientPubRaw.length)
  aad.set(encappedPublic, 0)
  aad.set(recipientPubRaw, encappedPublic.length)

  const pt = await recipient.open(
    ciphertext.buffer.slice(
      ciphertext.byteOffset,
      ciphertext.byteOffset + ciphertext.byteLength,
    ),
    aad.buffer.slice(aad.byteOffset, aad.byteOffset + aad.byteLength),
  )
  return new Uint8Array(pt)
}

async function generateRecipientKey(): Promise<{
  pair: CryptoKeyPair
  raw: Uint8Array
}> {
  const pair = (await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    /* extractable */ true,
    ['deriveBits'],
  )) as CryptoKeyPair
  const raw = new Uint8Array(
    await crypto.subtle.exportKey('raw', pair.publicKey),
  )
  return { pair, raw }
}

describe('hpkeSealP256', () => {
  it('produces a 65-byte encappedPublic and ciphertext = plaintext + 16-byte tag', async () => {
    const { raw } = await generateRecipientKey()
    const plaintext = new TextEncoder().encode('hello turnkey')

    const { encappedPublic, ciphertext } = await hpkeSealP256({
      receiverPublicKey: raw,
      plaintext,
    })

    expect(encappedPublic.length).toBe(65)
    expect(encappedPublic[0]).toBe(0x04) // SEC1 uncompressed prefix
    expect(ciphertext.length).toBe(plaintext.length + 16) // GCM tag is 16 bytes
  })

  it('round-trips against @hpke/core (Turnkey suite + AAD shape)', async () => {
    const { pair, raw } = await generateRecipientKey()
    const plaintext = new TextEncoder().encode(
      JSON.stringify({ otp_code: '123456', public_key: '0204aabb...' }),
    )

    const sealed = await hpkeSealP256({
      receiverPublicKey: raw,
      plaintext,
    })

    const opened = await openWithHpkeCore({
      recipientKey: pair,
      recipientPubRaw: raw,
      encappedPublic: sealed.encappedPublic,
      ciphertext: sealed.ciphertext,
    })

    expect(new TextDecoder().decode(opened)).toBe(
      new TextDecoder().decode(plaintext),
    )
  })

  it('produces different ciphertexts on each call (ephemeral key randomness)', async () => {
    const { raw } = await generateRecipientKey()
    const plaintext = new TextEncoder().encode('same input')

    const a = await hpkeSealP256({ receiverPublicKey: raw, plaintext })
    const b = await hpkeSealP256({ receiverPublicKey: raw, plaintext })

    expect(a.encappedPublic).not.toEqual(b.encappedPublic)
    expect(a.ciphertext).not.toEqual(b.ciphertext)
  })

  it('rejects a non-65-byte receiver public key', async () => {
    await expect(
      hpkeSealP256({
        receiverPublicKey: new Uint8Array(33), // compressed, wrong size
        plaintext: new Uint8Array(),
      }),
    ).rejects.toThrow(/65 bytes/)
  })
})
