import { ApiKeyStamper, SignatureFormat } from '@turnkey/api-key-stamper'
import { generateP256KeyPair, verifyStampSignature } from '@turnkey/crypto'
import * as SecureStore from 'expo-secure-store'
import type { ApiKeyStamper as ZDApiKeyStamper } from '../../stampers/types.js'

const KEY_PAIR = 'zerodev.keyPair'
const LEGACY_PUBLIC_KEY = 'zerodev.publicKey'
const LEGACY_PRIVATE_KEY = 'zerodev.privateKey'

type StoredKeyPair = { publicKey: string; privateKey: string }
const KEY_PAIR_CHECK = 'ZeroDev Wallet key-pair ownership check'

function parseKeyPair(value: string | null): StoredKeyPair | null {
  if (!value) return null
  try {
    const pair = JSON.parse(value) as Partial<StoredKeyPair>
    if (
      typeof pair.publicKey !== 'string' ||
      !pair.publicKey ||
      typeof pair.privateKey !== 'string' ||
      !pair.privateKey
    ) {
      return null
    }
    return pair as StoredKeyPair
  } catch {
    return null
  }
}

class SecureStoreStamperInner {
  private publicKeyHex: string | null = null

  async init(): Promise<void> {
    const storedPair = parseKeyPair(await SecureStore.getItemAsync(KEY_PAIR))
    if (storedPair) {
      await this.validateKeyPair(storedPair)
      this.publicKeyHex = storedPair.publicKey
      return
    }

    const publicKey = await SecureStore.getItemAsync(LEGACY_PUBLIC_KEY)
    const privateKey = await SecureStore.getItemAsync(LEGACY_PRIVATE_KEY)
    if (publicKey && privateKey) {
      await this.persistKeyPair({ publicKey, privateKey })
      await Promise.all([
        SecureStore.deleteItemAsync(LEGACY_PUBLIC_KEY),
        SecureStore.deleteItemAsync(LEGACY_PRIVATE_KEY),
      ])
      return
    }

    await this.resetKeyPair()
  }

  async getPublicKey(): Promise<string | null> {
    return this.publicKeyHex
  }

  async resetKeyPair(externalKeyPair?: StoredKeyPair): Promise<void> {
    const pair = externalKeyPair ?? generateP256KeyPair()
    await this.persistKeyPair(pair)
  }

  private async persistKeyPair(pair: StoredKeyPair): Promise<void> {
    await this.validateKeyPair(pair)
    // SecureStore replaces one value atomically. Update memory only after the
    // durable write succeeds, so a failed rotation preserves the live pair.
    await SecureStore.setItemAsync(KEY_PAIR, JSON.stringify(pair))
    this.publicKeyHex = pair.publicKey
  }

  private async validateKeyPair(pair: StoredKeyPair): Promise<void> {
    try {
      const signature = await new ApiKeyStamper({
        apiPublicKey: pair.publicKey,
        apiPrivateKey: pair.privateKey,
      }).sign(KEY_PAIR_CHECK, SignatureFormat.Der)
      if (
        await verifyStampSignature(pair.publicKey, signature, KEY_PAIR_CHECK)
      ) {
        return
      }
    } catch {
      // Normalize invalid encoding and mismatched-key failures below.
    }
    throw new Error('Stored public and private keys do not match.')
  }

  private async getTurnkeyApiKeyStamper(): Promise<ApiKeyStamper> {
    if (!this.publicKeyHex) {
      throw new Error(
        'Key not initialized. Call init() or resetKeyPair() first.',
      )
    }

    const pair = parseKeyPair(await SecureStore.getItemAsync(KEY_PAIR))
    if (!pair || pair.publicKey !== this.publicKeyHex) {
      throw new Error('No matching key pair found in secure store.')
    }

    return new ApiKeyStamper({
      apiPublicKey: this.publicKeyHex,
      apiPrivateKey: pair.privateKey,
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
    // Remove legacy recovery sources first. If this fails, keep the atomic
    // record authoritative so a later init cannot resurrect a revoked key.
    await Promise.all([
      SecureStore.deleteItemAsync(LEGACY_PUBLIC_KEY),
      SecureStore.deleteItemAsync(LEGACY_PRIVATE_KEY),
    ])
    await SecureStore.deleteItemAsync(KEY_PAIR)
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
      pendingKeyPair = null
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
    async stampPending(payload: string) {
      if (!pendingKeyPair) throw new Error('No pending key rotation')
      return new ApiKeyStamper({
        apiPublicKey: pendingKeyPair.publicKey,
        apiPrivateKey: pendingKeyPair.privateKey,
      }).stamp(payload)
    },
    async signPending(payload: string) {
      if (!pendingKeyPair) throw new Error('No pending key rotation')
      return new ApiKeyStamper({
        apiPublicKey: pendingKeyPair.publicKey,
        apiPrivateKey: pendingKeyPair.privateKey,
      }).sign(payload, SignatureFormat.Der)
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
