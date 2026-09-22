import { describe, expect, it } from 'vitest'
import { createPrivateKeyStamper } from '../stampers/privateKeyStamper.js'
import { generateP256KeyPair } from './p256KeyPair.js'

describe('generateP256KeyPair', () => {
  it('returns a 32-byte scalar and its 33-byte compressed public key as hex', async () => {
    const { privateKey, publicKey } = generateP256KeyPair()

    expect(privateKey).toMatch(/^[0-9a-f]{64}$/)
    expect(publicKey).toMatch(/^0[23][0-9a-f]{64}$/)
    await expect(
      createPrivateKeyStamper(privateKey).getPublicKey(),
    ).resolves.toBe(publicKey)
  })

  it('returns a fresh pair on every call', () => {
    expect(generateP256KeyPair().privateKey).not.toBe(
      generateP256KeyPair().privateKey,
    )
  })
})
