import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPrivateKeyStamper } from '../stampers/privateKeyStamper.js'
import { generateP256KeyPair } from '../utils/p256KeyPair.js'
import {
  createServerWalletClient,
  type ServerWalletClientConfig,
} from './createServerWalletClient.js'

describe('createServerWalletClient', () => {
  it('builds a private-key stamper from a private key', async () => {
    const { privateKey, publicKey } = generateP256KeyPair()
    const client = createServerWalletClient({
      organizationId: 'org',
      privateKey,
    })
    await expect(client.apiKeyStamper.getPublicKey()).resolves.toBe(publicKey)
  })

  it('uses the given stamper over a private key', async () => {
    const own = createPrivateKeyStamper(generateP256KeyPair().privateKey)
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

  it('throws when the config has neither a private key nor a stamper', () => {
    expect(() =>
      createServerWalletClient({
        organizationId: 'org',
      } as ServerWalletClientConfig),
    ).toThrow('createServerWalletClient: pass `privateKey` or `stamper`')
  })

  it('carries the organizationId that createServerWallet defaults to', () => {
    const client = createServerWalletClient({
      organizationId: 'org',
      privateKey: generateP256KeyPair().privateKey,
    })
    expect(client.organizationId).toBe('org')
  })

  describe('transport options', () => {
    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('targets production when no proxyBaseUrl is given', () => {
      const client = createServerWalletClient({
        organizationId: 'org',
        privateKey: generateP256KeyPair().privateKey,
      })
      expect(client.transport.url).toBe('https://kms.zerodev.app/api/v1')
    })

    it('sends requests to proxyBaseUrl with fetchOptions applied', async () => {
      const fetchMock = vi.fn(async () => ({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({}),
      }))
      vi.stubGlobal('fetch', fetchMock)
      const client = createServerWalletClient({
        organizationId: 'org',
        privateKey: generateP256KeyPair().privateKey,
        proxyBaseUrl: 'https://kms.staging.zerodev.app/api/v1',
        fetchOptions: { headers: { Origin: 'http://localhost:3000' } },
      })

      await client.createServerWallet({ projectId: 'project' })

      const [url, init] = fetchMock.mock.calls[0] as unknown as [
        string,
        RequestInit,
      ]
      expect(url).toBe(
        'https://kms.staging.zerodev.app/api/v1/project/server-wallet/wallets',
      )
      expect((init.headers as Record<string, string>).Origin).toBe(
        'http://localhost:3000',
      )
    })
  })
})
