import { IndexedDbStamper as TurnkeyIndexedDbStamper } from '@turnkey/indexed-db-stamper'
import { generateCompressedPublicKeyFromKeyPair } from '../utils/utils.js'
import type { ApiKeyStamper } from './types.js'

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
    async clear() {
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
    async commitKeyRotation() {
      if (!pendingKeyPair) {
        throw new Error('No pending key rotation to commit')
      }
      await inner.resetKeyPair(pendingKeyPair)
      pendingKeyPair = null
    },
  }
}
