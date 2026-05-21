import { ApiKeyStamper, SignatureFormat } from '@turnkey/api-key-stamper'
import { generateP256KeyPair } from '@turnkey/crypto'
import * as SecureStore from 'expo-secure-store'
import type { ApiKeyStamper as ZDApiKeyStamper } from '../../stampers/types.js'

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

  private async getTurnkeyApiKeyStamper(): Promise<ApiKeyStamper> {
    if (!this.publicKeyHex) {
      throw new Error(
        'Key not initialized. Call init() or resetKeyPair() first.',
      )
    }

    const privateKey = await SecureStore.getItemAsync(PRIVATE_KEY)
    if (!privateKey) {
      throw new Error('No private key found in secure store.')
    }

    return new ApiKeyStamper({
      apiPublicKey: this.publicKeyHex,
      apiPrivateKey: privateKey,
    })
  }

  async stamp(
    payload: string,
  ): Promise<{ stampHeaderName: string; stampHeaderValue: string }> {
    const stamper = await this.getTurnkeyApiKeyStamper()
    const { stampHeaderName, stampHeaderValue } = await stamper.stamp(payload)
    return { stampHeaderName, stampHeaderValue }
  }

  async sign(payload: string): Promise<string> {
    const stamper = await this.getTurnkeyApiKeyStamper()
    return stamper.sign(payload, SignatureFormat.Der)
  }

  async clear(): Promise<void> {
    await SecureStore.deleteItemAsync(PUBLIC_KEY)
    await SecureStore.deleteItemAsync(PRIVATE_KEY)
    this.publicKeyHex = null
  }
}

async function warmApiKeyStamperForMetroDev(
  inner: SecureStoreStamperInner,
): Promise<void> {
  // `__DEV__` is a global set by React Native's Metro; read it via globalThis
  // so this file needs no ambient `.d.ts` (which would conflict with RN's own
  // typings when both happen to be in scope, e.g. in the editor).
  if (!(globalThis as { __DEV__?: boolean }).__DEV__) return

  // In Expo dev, Turnkey's API key stamper loads its React Native signer with a
  // dynamic import the first time `stamp()` runs. OTP verification is usually
  // the first code path that stamps a payload, and if the app was backgrounded
  // while the user copied the code, Metro can serve that lazy module after
  // foregrounding and trigger a full JS reload. Warming the stamper during dev
  // startup makes Metro load the signer while the app is foregrounded; production
  // builds do not use Metro and skip this block via `__DEV__`.
  try {
    await inner.stamp('{"purpose":"metro-dev-warmup"}')
  } catch (error) {
    // biome-ignore lint/suspicious/noConsole: This only runs in dev mode
    console.warn('Failed to warm API key stamper in dev:', error)
  }
}

export async function createSecureStoreStamper(): Promise<ZDApiKeyStamper> {
  const inner = new SecureStoreStamperInner()
  await inner.init()
  await warmApiKeyStamperForMetroDev(inner)

  let pendingKeyPair: { publicKey: string; privateKey: string } | null = null

  return {
    async getPublicKey() {
      return inner.getPublicKey()
    },
    async stamp(payload: string) {
      return inner.stamp(payload)
    },
    async sign(payload: string) {
      return inner.sign(payload)
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
