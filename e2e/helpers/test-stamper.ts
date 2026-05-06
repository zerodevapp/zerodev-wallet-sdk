/**
 * Node.js ECDSA P-256 stamper implementing the IndexedDbStamper interface.
 * Port of doorway-kms/pkg/test/apikey.go
 *
 * Uses node:crypto for key generation and signing, producing stamps
 * compatible with Turnkey's API key authentication format.
 */

import { createSign, generateKeyPairSync, type KeyObject } from 'node:crypto'
import type {
  ApiKeyStamper,
  Stamp,
} from '../../packages/core/src/stampers/types.js'

export type TestStamperKeyPair = {
  privateKey: KeyObject
  publicKey: KeyObject
}

/**
 * Creates a test stamper that implements the IndexedDbStamper interface
 * using Node.js crypto instead of browser IndexedDB.
 */
export function createTestStamper(): ApiKeyStamper & {
  /** Expose the key pair for tests that need direct access */
  getKeyPair(): TestStamperKeyPair | null
} {
  let keyPair: TestStamperKeyPair | null = null
  let pendingKeyPair: TestStamperKeyPair | null = null

  function ensureKeyPair(): TestStamperKeyPair {
    if (!keyPair) {
      keyPair = generateP256KeyPair()
    }
    return keyPair
  }

  return {
    async getPublicKey(): Promise<string | null> {
      const kp = ensureKeyPair()
      return getCompressedPublicKeyHex(kp.publicKey)
    },

    async stamp(payload: string): Promise<Stamp> {
      const kp = ensureKeyPair()
      const publicKeyHex = getCompressedPublicKeyHex(kp.publicKey)

      // Sign the payload (DER-encoded ECDSA signature)
      const signer = createSign('SHA256')
      signer.update(payload)
      const derSignature = signer.sign(kp.privateKey)
      const signatureHex = derSignature.toString('hex')

      // Build the stamp value matching Turnkey's API key stamp format
      const stampJson = JSON.stringify({
        publicKey: publicKeyHex,
        signature: signatureHex,
        scheme: 'SIGNATURE_SCHEME_TK_API_P256',
      })
      const stampHeaderValue = base64UrlEncode(Buffer.from(stampJson))

      return {
        stampHeaderName: 'X-Stamp',
        stampHeaderValue,
      }
    },

    async resetKeyPair(externalKeyPair?: CryptoKeyPair): Promise<void> {
      if (externalKeyPair) {
        // Convert Web Crypto CryptoKeyPair to Node.js KeyObject
        // This path is for compatibility but tests typically use the default path
        throw new Error(
          'External CryptoKeyPair not supported in test stamper. Use the default key generation.',
        )
      }
      keyPair = generateP256KeyPair()
    },

    async clear(): Promise<void> {
      keyPair = null
    },

    getKeyPair(): TestStamperKeyPair | null {
      return keyPair
    },

    async prepareKeyRotation() {
      const keyPair = generateP256KeyPair()
      pendingKeyPair = keyPair
      return getCompressedPublicKeyHex(pendingKeyPair.publicKey)
    },
    async commitKeyRotation() {
      if (!pendingKeyPair) {
        throw new Error('No pending key rotation to commit')
      }
      keyPair = pendingKeyPair
      pendingKeyPair = null
    },
  }
}

function generateP256KeyPair(): TestStamperKeyPair {
  const { privateKey, publicKey } = generateKeyPairSync('ec', {
    namedCurve: 'P-256',
  })
  return { privateKey, publicKey }
}

/**
 * Gets the compressed public key as a hex string (33 bytes).
 * Compressed P-256 format: 0x02/0x03 prefix + 32 bytes X coordinate
 */
function getCompressedPublicKeyHex(publicKey: KeyObject): string {
  // Export as uncompressed (65 bytes: 0x04 + X + Y)
  const raw = publicKey.export({ type: 'spki', format: 'der' })
  // The last 65 bytes of SPKI DER are the uncompressed point
  const uncompressed = raw.subarray(raw.length - 65)

  if (uncompressed[0] !== 0x04) {
    throw new Error('Expected uncompressed public key starting with 0x04')
  }

  const x = uncompressed.subarray(1, 33)
  const y = uncompressed.subarray(33, 65)

  // Prefix: 0x02 if Y is even, 0x03 if Y is odd
  const prefix = (y[y.length - 1]! & 1) === 0 ? 0x02 : 0x03

  const compressed = Buffer.alloc(33)
  compressed[0] = prefix
  x.copy(compressed, 1)

  return compressed.toString('hex')
}

function base64UrlEncode(buf: Buffer): string {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}
