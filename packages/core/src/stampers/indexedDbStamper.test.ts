import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  activePublicKey: 'active-public-key',
  expectedPendingPublicKey: '',
  resetKeyPair: vi.fn(),
}))

vi.mock('@turnkey/indexed-db-stamper', () => ({
  IndexedDbStamper: class {
    async init() {}
    async getPublicKey() {
      return h.activePublicKey
    }
    async stamp() {
      return { stampHeaderName: 'X-Stamp', stampHeaderValue: 'active-stamp' }
    }
    async sign() {
      return 'active-signature'
    }
    async clear() {}
    async resetKeyPair(keyPair?: CryptoKeyPair) {
      await h.resetKeyPair(keyPair)
      if (keyPair) h.activePublicKey = h.expectedPendingPublicKey
    }
  },
}))

import { createIndexedDbStamper } from './indexedDbStamper.js'

function deferred() {
  let release = () => {}
  const promise = new Promise<void>((resolve) => {
    release = resolve
  })
  return { promise, release }
}

beforeEach(() => {
  vi.clearAllMocks()
  h.activePublicKey = 'active-public-key'
  h.expectedPendingPublicKey = ''
  h.resetKeyPair.mockResolvedValue(undefined)
})

describe('createIndexedDbStamper', () => {
  it('keeps the old key active until a pending key is explicitly committed', async () => {
    const stamper = await createIndexedDbStamper()

    const pendingPublicKey = await stamper.prepareKeyRotation()
    h.expectedPendingPublicKey = pendingPublicKey

    await expect(stamper.getPublicKey()).resolves.toBe('active-public-key')
    expect(await stamper.signPending('proof')).toMatch(/^30[0-9a-f]+$/)
    const pendingStamp = await stamper.stampPending('proof')
    const stampPayload = JSON.parse(
      atob(pendingStamp.stampHeaderValue.replace(/-/g, '+').replace(/_/g, '/')),
    )
    expect(stampPayload).toMatchObject({
      publicKey: pendingPublicKey,
      scheme: 'SIGNATURE_SCHEME_TK_API_P256',
    })

    await stamper.commitKeyRotation()

    await expect(stamper.getPublicKey()).resolves.toBe(pendingPublicKey)
    expect(h.resetKeyPair).toHaveBeenCalledWith(expect.any(Object))
  })

  it('discards a pending key without touching the active key', async () => {
    const stamper = await createIndexedDbStamper()
    await stamper.prepareKeyRotation()

    await stamper.discardKeyRotation()

    await expect(stamper.getPublicKey()).resolves.toBe('active-public-key')
    await expect(stamper.signPending('proof')).rejects.toThrow(
      'No pending key rotation',
    )
    expect(h.resetKeyPair).not.toHaveBeenCalled()
  })

  it('keeps active signing available while a pending commit is blocked', async () => {
    const stamper = await createIndexedDbStamper()
    const pendingPublicKey = await stamper.prepareKeyRotation()
    h.expectedPendingPublicKey = pendingPublicKey
    const writeStarted = deferred()
    const releaseWrite = deferred()
    h.resetKeyPair.mockImplementationOnce(async () => {
      writeStarted.release()
      await releaseWrite.promise
    })

    const commit = stamper.commitKeyRotation()
    await writeStarted.promise

    await expect(stamper.getPublicKey()).resolves.toBe('active-public-key')
    await expect(stamper.sign('wallet-request')).resolves.toBe(
      'active-signature',
    )

    releaseWrite.release()
    await commit
    await expect(stamper.getPublicKey()).resolves.toBe(pendingPublicKey)
  })

  it('preserves the active key when pending commit fails', async () => {
    const stamper = await createIndexedDbStamper()
    await stamper.prepareKeyRotation()
    h.resetKeyPair.mockRejectedValueOnce(new Error('indexeddb unavailable'))

    await expect(stamper.commitKeyRotation()).rejects.toThrow(
      'indexeddb unavailable',
    )

    await expect(stamper.getPublicKey()).resolves.toBe('active-public-key')
    await expect(stamper.sign('wallet-request')).resolves.toBe(
      'active-signature',
    )
    await expect(stamper.signPending('proof')).resolves.toMatch(/^30[0-9a-f]+$/)
  })
})
