import { generateP256KeyPair, verifyStampSignature } from '@turnkey/crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  store: new Map<string, string>(),
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}))

vi.mock('expo-secure-store', () => ({
  getItemAsync: h.getItemAsync,
  setItemAsync: h.setItemAsync,
  deleteItemAsync: h.deleteItemAsync,
}))

import { createSecureStoreStamper } from './secureStore.js'

function deferred() {
  let release = () => {}
  const promise = new Promise<void>((resolve) => {
    release = resolve
  })
  return { promise, release }
}

beforeEach(() => {
  vi.clearAllMocks()
  h.store.clear()
  h.getItemAsync.mockImplementation(async (key: string) => {
    return h.store.get(key) ?? null
  })
  h.setItemAsync.mockImplementation(async (key: string, value: string) => {
    h.store.set(key, value)
  })
  h.deleteItemAsync.mockImplementation(async (key: string) => {
    h.store.delete(key)
  })
})

describe('createSecureStoreStamper', () => {
  it('migrates the legacy split key without generating a replacement', async () => {
    const legacyPair = generateP256KeyPair()
    h.store.set('zerodev.publicKey', legacyPair.publicKey)
    h.store.set('zerodev.privateKey', legacyPair.privateKey)

    const stamper = await createSecureStoreStamper()

    await expect(stamper.getPublicKey()).resolves.toBe(legacyPair.publicKey)
    const storedPair = h.store.get('zerodev.keyPair')
    if (!storedPair) throw new Error('Expected migrated key pair')
    expect(JSON.parse(storedPair)).toEqual({
      publicKey: legacyPair.publicKey,
      privateKey: legacyPair.privateKey,
    })
    expect(h.store.has('zerodev.publicKey')).toBe(false)
    expect(h.store.has('zerodev.privateKey')).toBe(false)
  })

  it('rejects a stored public/private key mismatch', async () => {
    const first = generateP256KeyPair()
    const second = generateP256KeyPair()
    h.store.set(
      'zerodev.keyPair',
      JSON.stringify({
        publicKey: first.publicKey,
        privateKey: second.privateKey,
      }),
    )

    await expect(createSecureStoreStamper()).rejects.toThrow(/do not match/i)
  })

  it('preserves the active pair when a pending-key commit cannot persist', async () => {
    const stamper = await createSecureStoreStamper()
    const originalPublicKey = await stamper.getPublicKey()
    const originalRecord = h.store.get('zerodev.keyPair')
    await stamper.prepareKeyRotation()
    h.setItemAsync.mockRejectedValueOnce(new Error('secure store unavailable'))

    await expect(stamper.commitKeyRotation()).rejects.toThrow(
      'secure store unavailable',
    )

    await expect(stamper.getPublicKey()).resolves.toBe(originalPublicKey)
    expect(h.store.get('zerodev.keyPair')).toBe(originalRecord)
  })

  it('does not delete the authoritative pair if legacy cleanup fails', async () => {
    const stamper = await createSecureStoreStamper()
    const originalRecord = h.store.get('zerodev.keyPair')
    h.store.set('zerodev.publicKey', 'stale-public')
    h.store.set('zerodev.privateKey', 'stale-private')
    h.deleteItemAsync.mockImplementation(async (key: string) => {
      if (key === 'zerodev.publicKey') throw new Error('legacy cleanup failed')
      h.store.delete(key)
    })

    await expect(stamper.clear()).rejects.toThrow('legacy cleanup failed')

    expect(h.store.get('zerodev.keyPair')).toBe(originalRecord)
  })

  it('keeps active and pending signatures cryptographically isolated', async () => {
    const stamper = await createSecureStoreStamper()
    const activePublicKey = await stamper.getPublicKey()
    if (!activePublicKey) throw new Error('Expected active public key')
    const pendingPublicKey = await stamper.prepareKeyRotation()

    const activeSignature = await stamper.sign('wallet-request')
    const pendingSignature = await stamper.signPending('proof')

    await expect(
      verifyStampSignature(activePublicKey, activeSignature, 'wallet-request'),
    ).resolves.toBe(true)
    await expect(
      verifyStampSignature(pendingPublicKey, pendingSignature, 'proof'),
    ).resolves.toBe(true)
    await expect(
      verifyStampSignature(pendingPublicKey, activeSignature, 'wallet-request'),
    ).resolves.toBe(false)
    await expect(
      verifyStampSignature(activePublicKey, pendingSignature, 'proof'),
    ).resolves.toBe(false)
  })

  it('keeps the active key usable while a pending commit is blocked', async () => {
    const stamper = await createSecureStoreStamper()
    const activePublicKey = await stamper.getPublicKey()
    if (!activePublicKey) throw new Error('Expected active public key')
    const pendingPublicKey = await stamper.prepareKeyRotation()
    const writeStarted = deferred()
    const releaseWrite = deferred()
    h.setItemAsync.mockImplementationOnce(
      async (key: string, value: string) => {
        writeStarted.release()
        await releaseWrite.promise
        h.store.set(key, value)
      },
    )

    const commit = stamper.commitKeyRotation()
    await writeStarted.promise

    await expect(stamper.getPublicKey()).resolves.toBe(activePublicKey)
    const signature = await stamper.sign('during-commit')
    await expect(
      verifyStampSignature(activePublicKey, signature, 'during-commit'),
    ).resolves.toBe(true)

    releaseWrite.release()
    await commit
    await expect(stamper.getPublicKey()).resolves.toBe(pendingPublicKey)
  })
})
