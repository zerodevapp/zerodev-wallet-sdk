import { IndexedDbStamper as TurnkeyIndexedDbStamper } from '@turnkey/indexed-db-stamper'
import type { IndexedDbStamper } from './types.js'

export async function createIndexedDbStamper(): Promise<IndexedDbStamper> {
  const inner = new TurnkeyIndexedDbStamper()
  await inner.init()

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
    async resetKeyPair(externalKeyPair?: CryptoKeyPair) {
      await inner.resetKeyPair(externalKeyPair)
    },
  }
}
