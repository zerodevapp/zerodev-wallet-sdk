import { p256 } from '@noble/curves/nist.js'
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js'
import { TURNKEY_STAMP_HEADER } from '../constants.js'
import { compactSignatureToDerHex, encodeStamp } from '../utils/utils.js'
import type { SigningStamper } from './types.js'

/**
 * Stamps with a P-256 private key held by the caller.
 */
export function createPrivateKeyStamper(privateKey: string): SigningStamper {
  const secretKey = hexToBytes(privateKey.replace(/^0x/, ''))
  const publicKey = bytesToHex(p256.getPublicKey(secretKey, true))

  const sign = async (payload: string) => {
    return compactSignatureToDerHex(
      p256.sign(new TextEncoder().encode(payload), secretKey),
    )
  }

  return {
    async getPublicKey() {
      return publicKey
    },
    sign,
    async stamp(payload) {
      return {
        stampHeaderName: TURNKEY_STAMP_HEADER,
        stampHeaderValue: encodeStamp(publicKey, await sign(payload)),
      }
    },
    async clear() {},
  }
}
