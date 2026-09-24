import { p256 } from '@noble/curves/nist.js'
import { bytesToHex } from '@noble/hashes/utils.js'

export type P256KeyPair = {
  /** Compressed SEC1 point, 33 bytes, hex. This is what Turnkey and the KMS register. */
  publicKey: string
  /** 32-byte scalar, hex. Shown once; the SDK never stores it. */
  privateKey: string
}

/**
 * Generates a P-256 keypair in the wire format the KMS expects. The same
 * shape serves any Turnkey API key: agent keys, owner keys, session keys.
 */
export function generateP256KeyPair(): P256KeyPair {
  const secretKey = p256.utils.randomSecretKey()
  return {
    publicKey: bytesToHex(p256.getPublicKey(secretKey, true)),
    privateKey: bytesToHex(secretKey),
  }
}
