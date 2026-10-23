import { describe, expect, it, vi } from 'vitest'
import { toViemAccount } from '../adapters/viem.js'
import { generateP256KeyPair } from '../utils/p256KeyPair.js'
import { createZeroDevServerWallet } from './createZeroDevServerWallet.js'

vi.mock('../adapters/viem.js', () => ({
  toViemAccount: vi.fn(async () => 'account'),
}))

const config = {
  projectId: 'project',
  organizationId: 'org',
  privateKey: generateP256KeyPair().privateKey,
}

describe('createZeroDevServerWallet', () => {
  it('builds a server wallet client from the config', async () => {
    const { privateKey, publicKey } = generateP256KeyPair()
    const wallet = createZeroDevServerWallet({ ...config, privateKey })

    expect(wallet.client.organizationId).toBe('org')
    await expect(wallet.client.apiKeyStamper.getPublicKey()).resolves.toBe(
      publicKey,
    )
  })

  it('createWallet targets the configured project', async () => {
    const wallet = createZeroDevServerWallet(config)
    const created = {
      walletId: 'wallet',
      walletAddress: `0x${'11'.repeat(20)}`,
    } as const
    const createServerWallet = vi
      .spyOn(wallet.client, 'createServerWallet')
      .mockResolvedValue(created)

    await expect(wallet.createWallet()).resolves.toEqual(created)
    expect(createServerWallet).toHaveBeenCalledWith({ projectId: 'project' })
  })

  it('createAddress targets the configured project with the wallet and path', async () => {
    const wallet = createZeroDevServerWallet(config)
    const created = {
      walletId: 'wallet',
      turnkeyId: 'account',
      path: "m/44'/60'/0'/0/1",
      walletAddress: `0x${'22'.repeat(20)}`,
    } as const
    const createServerWalletAddress = vi
      .spyOn(wallet.client, 'createServerWalletAddress')
      .mockResolvedValue(created)

    await expect(
      wallet.createAddress({ walletId: 'wallet', path: "m/44'/60'/0'/0/1" }),
    ).resolves.toEqual(created)
    expect(createServerWalletAddress).toHaveBeenCalledWith({
      projectId: 'project',
      walletId: 'wallet',
      path: "m/44'/60'/0'/0/1",
    })
  })

  it('toAccount delegates to toViemAccount with the client, project, and address, and no session', async () => {
    const wallet = createZeroDevServerWallet(config)
    const address = `0x${'11'.repeat(20)}` as const

    await expect(wallet.toAccount({ address })).resolves.toBe('account')
    expect(toViemAccount).toHaveBeenCalledWith({
      client: wallet.client,
      organizationId: 'org',
      projectId: 'project',
      address,
    })
  })
})
