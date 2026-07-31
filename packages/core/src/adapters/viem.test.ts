import { zeroAddress } from 'viem'
import { describe, expect, it } from 'vitest'
import type { ZeroDevWalletClient } from '../client/index.js'
import { toViemAccount } from './viem.js'

const base = {
  organizationId: 'org',
  projectId: 'proj',
  getToken: () => 'token',
}

function clientWith(getUserWallet: unknown): ZeroDevWalletClient {
  return { getUserWallet } as unknown as ZeroDevWalletClient
}

describe('toViemAccount owner resolution', () => {
  it('throws when getUserWallet fails (no zeroAddress fallback)', async () => {
    const client = clientWith(async () => {
      throw new Error('session expired')
    })
    await expect(toViemAccount({ ...base, client })).rejects.toThrow()
  })

  it('refuses when no wallet address is returned', async () => {
    const client = clientWith(async () => ({ walletAddresses: [] }))
    await expect(toViemAccount({ ...base, client })).rejects.toThrow(
      /Cannot build account/i,
    )
  })

  it('refuses when the wallet address is the zero address', async () => {
    const client = clientWith(async () => ({ walletAddresses: [zeroAddress] }))
    await expect(toViemAccount({ ...base, client })).rejects.toThrow(
      /Cannot build account/i,
    )
  })

  it('refuses a malformed (non-hex) address', async () => {
    const client = clientWith(async () => ({
      walletAddresses: [`0x${'Z'.repeat(40)}`],
    }))
    await expect(toViemAccount({ ...base, client })).rejects.toThrow(
      /Cannot build account/i,
    )
  })

  it('builds an account with a valid resolved owner address', async () => {
    const owner = '0x1111111111111111111111111111111111111111'
    const client = clientWith(async () => ({ walletAddresses: [owner] }))
    const account = await toViemAccount({ ...base, client })
    expect(account.address).toBe(owner)
  })
})
