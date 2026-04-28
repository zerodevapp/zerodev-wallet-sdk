import { ApiKeyStamper } from '@turnkey/api-key-stamper'
import { generateP256KeyPair } from '@turnkey/crypto'
import type { ApiKeyStamper as ZDApiKeyStamper } from '@zerodev/wallet-core'
import * as SecureStore from 'expo-secure-store'

const PUBLIC_KEY = 'zerodev.publicKey'
const PRIVATE_KEY = 'zerodev.privateKey'

class SecureStoreStamperInner {
  private publicKeyHex: string | null = null

  async init(): Promise<void> {
    const publicKey = await SecureStore.getItemAsync(PUBLIC_KEY)
    const privateKey = await SecureStore.getItemAsync(PRIVATE_KEY)

    if (publicKey && privateKey) {
      this.publicKeyHex = publicKey
    } else {
      await this.resetKeyPair()
    }
  }

  async getPublicKey(): Promise<string | null> {
    return this.publicKeyHex
  }

  async resetKeyPair(externalKeyPair?: {
    publicKey: string
    privateKey: string
  }): Promise<void> {
    await this.clear()

    const pair = externalKeyPair ?? generateP256KeyPair()

    await SecureStore.setItemAsync(PUBLIC_KEY, pair.publicKey)
    await SecureStore.setItemAsync(PRIVATE_KEY, pair.privateKey)

    this.publicKeyHex = pair.publicKey
  }

  async stamp(
    payload: string,
  ): Promise<{ stampHeaderName: string; stampHeaderValue: string }> {
    if (!this.publicKeyHex) {
      throw new Error(
        'Key not initialized. Call init() or resetKeyPair() first.',
      )
    }

    const privateKey = await SecureStore.getItemAsync(PRIVATE_KEY)
    if (!privateKey) {
      throw new Error('No private key found in secure store.')
    }

    const stamper = new ApiKeyStamper({
      apiPublicKey: this.publicKeyHex,
      apiPrivateKey: privateKey,
    })

    const { stampHeaderName, stampHeaderValue } = await stamper.stamp(payload)
    return { stampHeaderName, stampHeaderValue }
  }

  async clear(): Promise<void> {
    await SecureStore.deleteItemAsync(PUBLIC_KEY)
    await SecureStore.deleteItemAsync(PRIVATE_KEY)
    this.publicKeyHex = null
  }
}

export async function createSecureStoreStamper(): Promise<ZDApiKeyStamper> {
  const inner = new SecureStoreStamperInner()
  await inner.init()

  let pendingKeyPair: { publicKey: string; privateKey: string } | null = null

  return {
    async getPublicKey() {
      return inner.getPublicKey()
    },
    async stamp(payload: string) {
      return inner.stamp(payload)
    },
    async clear() {
      await inner.clear()
    },
    async resetKeyPair() {
      pendingKeyPair = null
      await inner.resetKeyPair()
    },
    async prepareKeyRotation() {
      const keyPair = generateP256KeyPair()
      pendingKeyPair = keyPair
      return keyPair.publicKey
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
