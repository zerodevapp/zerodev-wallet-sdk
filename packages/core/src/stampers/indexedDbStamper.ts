import { IndexedDbStamper as TurnkeyIndexedDbStamper } from '@turnkey/indexed-db-stamper'
import { TURNKEY_STAMP_HEADER } from '../constants.js'
import {
  compactSignatureToDerHex,
  encodeStamp,
  generateCompressedPublicKeyFromKeyPair,
} from '../utils/utils.js'
import type { ApiKeyStamper } from './types.js'

async function signWithKeyPair(
  keyPair: CryptoKeyPair,
  payload: string,
): Promise<string> {
  const rawSignature = new Uint8Array(
    await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      keyPair.privateKey,
      new TextEncoder().encode(payload),
    ),
  )
  return compactSignatureToDerHex(rawSignature)
}

export async function createIndexedDbStamper(): Promise<ApiKeyStamper> {
  const inner = new TurnkeyIndexedDbStamper()
  await inner.init()

  let pendingKeyPair: CryptoKeyPair | null = null

  // A rotation must be prepared before it can be stamped/signed with; centralize
  // the guard so the pending-key paths don't each repeat it.
  const requirePending = (): CryptoKeyPair => {
    if (!pendingKeyPair) throw new Error('No pending key rotation')
    return pendingKeyPair
  }

  return {
    async getPublicKey() {
      return await inner.getPublicKey()
    },
    async stamp(payload: string) {
      return await inner.stamp(payload)
    },
    async sign(payload: string) {
      return await inner.sign(payload)
    },
    async clear() {
      pendingKeyPair = null
      await inner.clear()
    },
    async resetKeyPair() {
      pendingKeyPair = null
      await inner.resetKeyPair()
    },
    async prepareKeyRotation() {
      const keyPair = await crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['sign', 'verify'],
      )
      pendingKeyPair = keyPair
      return await generateCompressedPublicKeyFromKeyPair(keyPair)
    },
    async stampPending(payload: string) {
      const keyPair = requirePending()
      const publicKey = await generateCompressedPublicKeyFromKeyPair(keyPair)
      const signature = await signWithKeyPair(keyPair, payload)
      return {
        stampHeaderName: TURNKEY_STAMP_HEADER,
        stampHeaderValue: encodeStamp(publicKey, signature),
      }
    },
    async signPending(payload: string) {
      return signWithKeyPair(requirePending(), payload)
    },
    async commitKeyRotation() {
      if (!pendingKeyPair) {
        throw new Error('No pending key rotation to commit')
      }
      await inner.resetKeyPair(pendingKeyPair)
      pendingKeyPair = null
    },
    async discardKeyRotation() {
      pendingKeyPair = null
    },
  }
}
