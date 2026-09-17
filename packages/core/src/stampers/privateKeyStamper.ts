import { p256 } from '@noble/curves/nist.js'
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js'
import { TURNKEY_STAMP_HEADER } from '../constants.js'
import type { SigningStamper } from './types.js'

const SCHEME = 'SIGNATURE_SCHEME_TK_API_P256'

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Stamps with a P-256 private key held by the caller.
 */
export function createPrivateKeyStamper(privateKey: string): SigningStamper {
  const secretKey = hexToBytes(privateKey.replace(/^0x/, ''))
  const publicKey = bytesToHex(p256.getPublicKey(secretKey, true))

  const sign = async (payload: string) => {
    const signature = p256.sign(new TextEncoder().encode(payload), secretKey)
    return p256.Signature.fromBytes(signature, 'compact').toHex('der')
  }

  return {
    async getPublicKey() {
      return publicKey
    },
    sign,
    async stamp(payload) {
      const envelope = JSON.stringify({
        publicKey,
        scheme: SCHEME,
        signature: await sign(payload),
      })
      return {
        stampHeaderName: TURNKEY_STAMP_HEADER,
        stampHeaderValue: base64UrlEncode(new TextEncoder().encode(envelope)),
      }
    },
    async clear() {},
  }
}
