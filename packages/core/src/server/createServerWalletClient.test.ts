import { describe, expect, it } from 'vitest'
import { createAgentKeyStamper } from '../stampers/agentKeyStamper.js'
import { generateP256KeyPair } from '../utils/p256KeyPair.js'
import { createServerWalletClient } from './createServerWalletClient.js'

describe('createServerWalletClient', () => {
  it('builds an agent-key stamper from a private key', async () => {
    const { privateKey, publicKey } = generateP256KeyPair()
    const client = createServerWalletClient({
      organizationId: 'org',
      privateKey,
    })
    await expect(client.apiKeyStamper.getPublicKey()).resolves.toBe(publicKey)
  })

  it('uses the given stamper over a private key', async () => {
    const own = createAgentKeyStamper(generateP256KeyPair().privateKey)
    const other = generateP256KeyPair()
    const client = createServerWalletClient({
      organizationId: 'org',
      privateKey: other.privateKey,
      stamper: own,
    })
    expect(client.apiKeyStamper).toBe(own)
  })

  it('exposes only the server wallet actions', () => {
    const client = createServerWalletClient({
      organizationId: 'org',
      privateKey: generateP256KeyPair().privateKey,
    })
    expect(typeof client.createServerWallet).toBe('function')
    expect(typeof client.signMessage).toBe('function')
    expect('signInWithOtp' in client).toBe(false)
  })
})
