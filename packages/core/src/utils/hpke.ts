/**
 * HPKE (RFC 9180) seal for Turnkey enclave-encrypted requests.
 *
 * Suite: DHKEM(P-256, HKDF-SHA256) / HKDF-SHA256 / AES-256-GCM
 *   - KEM ID  = 0x0010 (DHKEM-P256-HKDF-SHA256)
 *   - KDF ID  = 0x0001 (HKDF-SHA256)
 *   - AEAD ID = 0x0002 (AES-256-GCM)
 *
 * Wire format and AAD construction match Turnkey's enclave_encrypt Go package:
 *   info = "turnkey_hpke"
 *   aad  = enc || pkR  (both 65-byte uncompressed P-256 points)
 *
 * References:
 *   - RFC 9180 §4 / §5
 *   - tkhq/go-sdk/pkg/enclave_encrypt
 */

import { gcm } from '@noble/ciphers/aes.js'
import { p256 } from '@noble/curves/nist.js'
import { expand, extract } from '@noble/hashes/hkdf.js'
import { sha256 } from '@noble/hashes/sha2.js'

const KEM_ID = 0x0010
const KDF_ID = 0x0001
const AEAD_ID = 0x0002

// Output sizes for the chosen primitives.
const NH = 32 // SHA-256 output
const NK = 32 // AES-256 key
const NN = 12 // AES-GCM nonce
const NPK = 65 // uncompressed P-256 point: 0x04 || X || Y

const TURNKEY_HPKE_INFO = new TextEncoder().encode('turnkey_hpke')

const HPKE_VERSION = new TextEncoder().encode('HPKE-v1')

// suite_id for the HPKE context: "HPKE" || I2OSP(KEM,2) || I2OSP(KDF,2) || I2OSP(AEAD,2)
const HPKE_SUITE_ID = concat(
  new TextEncoder().encode('HPKE'),
  i2osp(KEM_ID, 2),
  i2osp(KDF_ID, 2),
  i2osp(AEAD_ID, 2),
)

// suite_id for the KEM scope: "KEM" || I2OSP(KEM,2)
const KEM_SUITE_ID = concat(new TextEncoder().encode('KEM'), i2osp(KEM_ID, 2))

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, p) => sum + p.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const p of parts) {
    out.set(p, offset)
    offset += p.length
  }
  return out
}

function i2osp(n: number, len: number): Uint8Array {
  const out = new Uint8Array(len)
  let value = n
  for (let i = len - 1; i >= 0; i--) {
    out[i] = value & 0xff
    value >>>= 8
  }
  return out
}

// LabeledExtract(salt, label, ikm, suite_id) =
//   HKDF-Extract(salt, "HPKE-v1" || suite_id || label || ikm)
function labeledExtract(
  salt: Uint8Array,
  label: string,
  ikm: Uint8Array,
  suiteId: Uint8Array,
): Uint8Array {
  const labeledIkm = concat(
    HPKE_VERSION,
    suiteId,
    new TextEncoder().encode(label),
    ikm,
  )
  return extract(sha256, labeledIkm, salt)
}

// LabeledExpand(prk, label, info, L, suite_id) =
//   HKDF-Expand(prk, I2OSP(L,2) || "HPKE-v1" || suite_id || label || info, L)
function labeledExpand(
  prk: Uint8Array,
  label: string,
  info: Uint8Array,
  length: number,
  suiteId: Uint8Array,
): Uint8Array {
  const labeledInfo = concat(
    i2osp(length, 2),
    HPKE_VERSION,
    suiteId,
    new TextEncoder().encode(label),
    info,
  )
  return expand(sha256, prk, labeledInfo, length)
}

// DHKEM Encap: returns (sharedSecret, enc)
// sharedSecret is 32 bytes; enc is the serialized ephemeral pubkey (65 bytes uncompressed).
function encap(receiverPublicKey: Uint8Array): {
  sharedSecret: Uint8Array
  enc: Uint8Array
} {
  const ephSk = p256.utils.randomSecretKey()
  const ephPkUncompressed = p256.getPublicKey(ephSk, false)

  // ECDH: returns the serialized shared point. Pass isCompressed=true so the
  // first byte is the SEC1 prefix and bytes [1, 33) are the x-coordinate.
  const sharedPoint = p256.getSharedSecret(
    ephSk,
    receiverPublicKey,
    /* isCompressed */ true,
  )
  const dh = sharedPoint.slice(1, 33)

  const kemContext = concat(ephPkUncompressed, receiverPublicKey)

  const eaePrk = labeledExtract(new Uint8Array(0), 'eae_prk', dh, KEM_SUITE_ID)
  const sharedSecret = labeledExpand(
    eaePrk,
    'shared_secret',
    kemContext,
    NH,
    KEM_SUITE_ID,
  )

  return { sharedSecret, enc: ephPkUncompressed }
}

// KeySchedule for mode_base: returns (key, base_nonce).
function keySchedule(
  sharedSecret: Uint8Array,
  info: Uint8Array,
): { key: Uint8Array; baseNonce: Uint8Array } {
  const empty = new Uint8Array(0)

  const pskIdHash = labeledExtract(empty, 'psk_id_hash', empty, HPKE_SUITE_ID)
  const infoHash = labeledExtract(empty, 'info_hash', info, HPKE_SUITE_ID)

  // mode_base = 0x00 prepended to (psk_id_hash || info_hash)
  const keyScheduleContext = concat(new Uint8Array([0]), pskIdHash, infoHash)

  const secret = labeledExtract(sharedSecret, 'secret', empty, HPKE_SUITE_ID)

  const key = labeledExpand(
    secret,
    'key',
    keyScheduleContext,
    NK,
    HPKE_SUITE_ID,
  )
  const baseNonce = labeledExpand(
    secret,
    'base_nonce',
    keyScheduleContext,
    NN,
    HPKE_SUITE_ID,
  )

  return { key, baseNonce }
}

function aesGcmSeal(
  key: Uint8Array,
  nonce: Uint8Array,
  aad: Uint8Array,
  plaintext: Uint8Array,
): Uint8Array {
  // Returns ciphertext || tag (16 bytes appended) — matches the single-blob
  // format Turnkey's `Sealer.Seal` and Web Crypto's AES-GCM produce.
  return gcm(key, nonce, aad).encrypt(plaintext)
}

export type HpkeSealResult = {
  /** Ephemeral sender public key (uncompressed P-256, 65 bytes). */
  encappedPublic: Uint8Array
  /** AES-256-GCM ciphertext with a 16-byte authentication tag appended. */
  ciphertext: Uint8Array
}

/**
 * Single-shot HPKE seal in mode_base for Turnkey's TLS Fetcher enclave.
 *
 * Uses the fixed Turnkey `info = "turnkey_hpke"` and the AAD shape
 * `enc || receiverPublicKey` so the resulting bundle is decryptable by
 * `enclave_encrypt.EnclaveEncryptServer.Decrypt`.
 *
 * @param receiverPublicKey - The enclave's ephemeral target public key
 *   (uncompressed P-256, 65 bytes), extracted from the encryption target bundle.
 * @param plaintext - The bytes to encrypt (e.g. the JSON-encoded OTP attempt).
 */
export async function hpkeSealP256({
  receiverPublicKey,
  plaintext,
}: {
  receiverPublicKey: Uint8Array
  plaintext: Uint8Array
}): Promise<HpkeSealResult> {
  if (receiverPublicKey.length !== NPK) {
    throw new Error(
      `hpkeSealP256: receiverPublicKey must be ${NPK} bytes (uncompressed P-256), got ${receiverPublicKey.length}`,
    )
  }

  const { sharedSecret, enc } = encap(receiverPublicKey)
  const { key, baseNonce } = keySchedule(sharedSecret, TURNKEY_HPKE_INFO)

  // First message of the context, sequence 0 → nonce = base_nonce.
  const aad = concat(enc, receiverPublicKey)
  const ciphertext = aesGcmSeal(key, baseNonce, aad, plaintext)

  return { encappedPublic: enc, ciphertext }
}
