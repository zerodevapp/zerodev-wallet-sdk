import { p256 } from '@noble/curves/nist.js'
import { IndexedDbStamper as TurnkeyIndexedDbStamper } from '@turnkey/indexed-db-stamper'
import { generateCompressedPublicKeyFromKeyPair } from '../utils/utils.js'
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
  return p256.Signature.fromBytes(rawSignature, 'compact').toHex('der')
}

function encodeStamp(publicKey: string, signature: string): string {
  const json = JSON.stringify({
    publicKey,
    scheme: 'SIGNATURE_SCHEME_TK_API_P256',
    signature,
  })
  return btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

export async function createIndexedDbStamper(): Promise<ApiKeyStamper> {
  const inner = new TurnkeyIndexedDbStamper()
  await inner.init()

  let pendingKeyPair: CryptoKeyPair | null = null

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
      if (!pendingKeyPair) throw new Error('No pending key rotation')
      const publicKey =
        await generateCompressedPublicKeyFromKeyPair(pendingKeyPair)
      const signature = await signWithKeyPair(pendingKeyPair, payload)
      return {
        stampHeaderName: 'X-Stamp',
        stampHeaderValue: encodeStamp(publicKey, signature),
      }
    },
    async signPending(payload: string) {
      if (!pendingKeyPair) throw new Error('No pending key rotation')
      return signWithKeyPair(pendingKeyPair, payload)
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
