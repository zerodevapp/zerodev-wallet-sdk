import { type Hex, keccak256, parseSignature, zeroAddress } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { hashAuthorization } from 'viem/utils'
import { describe, expect, it, vi } from 'vitest'
import type { ZeroDevWalletClient } from '../client/index.js'
import { toViemAccount } from './viem.js'

const base = {
  organizationId: 'org',
  projectId: 'proj',
  getToken: () => 'token',
}

function clientWith(
  getUserWallet: unknown,
  signMessage?: unknown,
): ZeroDevWalletClient {
  return { getUserWallet, signMessage } as unknown as ZeroDevWalletClient
}

function signWith(privateKey: Hex) {
  const signer = privateKeyToAccount(privateKey)
  const signMessage = vi.fn(
    async ({
      message,
      encoding,
    }: {
      message: string
      encoding: 'utf8' | 'hex'
    }) =>
      signer.signMessage({
        message:
          encoding === 'hex'
            ? { raw: `0x${message.replace(/^0x/, '')}` as Hex }
            : message,
      }),
  )
  return { signer, signMessage }
}

function adversarialClient(
  owner: ReturnType<typeof privateKeyToAccount>,
  attacker: ReturnType<typeof privateKeyToAccount>,
): ZeroDevWalletClient {
  return {
    getUserWallet: vi.fn(async () => ({ walletAddresses: [owner.address] })),
    signMessage: vi.fn(
      async ({ message, encoding }: { message: string; encoding: string }) =>
        attacker.signMessage({
          message:
            encoding === 'hex'
              ? { raw: `0x${message.replace(/^0x/, '')}` as Hex }
              : message,
        }),
    ),
    signTransaction: vi.fn(
      async ({ unsignedTransaction }: { unsignedTransaction: string }) =>
        attacker.sign({ hash: keccak256(`0x${unsignedTransaction}`) }),
    ),
    signTypedDataV4: vi.fn(
      async ({ typedDataHash }: { typedDataHash: string }) =>
        attacker.sign({ hash: `0x${typedDataHash}` }),
    ),
    sign7702Authorization: vi.fn(
      async ({ hashedAuthorization }: { hashedAuthorization: string }) =>
        attacker.sign({ hash: `0x${hashedAuthorization}` }),
    ),
  } as unknown as ZeroDevWalletClient
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
    const { signer, signMessage } = signWith(`0x${'11'.repeat(32)}`)
    const client = clientWith(
      async () => ({ walletAddresses: [signer.address] }),
      signMessage,
    )
    const account = await toViemAccount({ ...base, client })
    expect(account.address).toBe(signer.address)
    expect(signMessage).not.toHaveBeenCalled()
  })

  it('rejects a later signing response from a different key', async () => {
    const owner = privateKeyToAccount(`0x${'11'.repeat(32)}`)
    const wrongSigner = privateKeyToAccount(`0x${'22'.repeat(32)}`)
    const signMessage = vi.fn(({ message }) =>
      wrongSigner.signMessage({ message }),
    )
    const client = clientWith(
      async () => ({ walletAddresses: [owner.address] }),
      signMessage,
    )
    const account = await toViemAccount({ ...base, client })

    await expect(account.signMessage({ message: 'transfer' })).rejects.toThrow(
      /recover|owner/i,
    )
  })

  it('rejects an attacker signature on every account signing route', async () => {
    const owner = privateKeyToAccount(`0x${'11'.repeat(32)}`)
    const attacker = privateKeyToAccount(`0x${'22'.repeat(32)}`)
    const account = await toViemAccount({
      ...base,
      client: adversarialClient(owner, attacker),
    })

    await expect(account.signMessage({ message: 'transfer' })).rejects.toThrow(
      /recover|owner/i,
    )
    await expect(
      account.signMessage({ message: { raw: '0x1234' } }),
    ).rejects.toThrow(/recover|owner/i)
    await expect(
      account.signTransaction({
        chainId: 1,
        gas: 21_000n,
        gasPrice: 1n,
        nonce: 0,
        to: owner.address,
        type: 'legacy',
        value: 1n,
      }),
    ).rejects.toThrow(/recover|owner/i)
    await expect(
      account.signTypedData({
        domain: { chainId: 1, name: 'Audit', version: '1' },
        types: { Audit: [{ name: 'statement', type: 'string' }] },
        primaryType: 'Audit',
        message: { statement: 'reject attacker' },
      }),
    ).rejects.toThrow(/recover|owner/i)
    if (!account.signAuthorization) {
      throw new Error('Expected account to support EIP-7702 authorization')
    }
    await expect(
      account.signAuthorization({
        contractAddress: owner.address,
        chainId: 1,
        nonce: 0,
      }),
    ).rejects.toThrow(/recover|owner/i)
  })

  it('preserves a zero yParity in a 7702 authorization', async () => {
    const owner = privateKeyToAccount(`0x${'11'.repeat(32)}`)
    const authorization = {
      address: owner.address,
      chainId: 1,
      nonce: 10,
    } as const
    const hash = hashAuthorization(authorization)
    const legacySignature = await owner.sign({ hash })
    expect(parseSignature(legacySignature).yParity).toBe(0)
    const paritySignature = `${legacySignature.slice(0, -2)}00` as Hex
    expect(parseSignature(paritySignature)).toMatchObject({ yParity: 0 })
    expect(parseSignature(paritySignature)).not.toHaveProperty('v')

    const client = {
      getUserWallet: vi.fn(async () => ({ walletAddresses: [owner.address] })),
      sign7702Authorization: vi.fn(async () => paritySignature),
    } as unknown as ZeroDevWalletClient
    const account = await toViemAccount({ ...base, client })
    if (!account.signAuthorization) {
      throw new Error('Expected account to support EIP-7702 authorization')
    }

    await expect(
      account.signAuthorization({
        contractAddress: authorization.address,
        chainId: authorization.chainId,
        nonce: authorization.nonce,
      }),
    ).resolves.toMatchObject({
      address: authorization.address,
      yParity: 0,
    })
  })

  it('preserves a one yParity in a 7702 authorization', async () => {
    const owner = privateKeyToAccount(`0x${'11'.repeat(32)}`)
    let authorization: { address: Hex; chainId: number; nonce: number } | null =
      null
    let paritySignature: Hex | null = null
    for (let nonce = 0; nonce < 32; nonce += 1) {
      const candidate = { address: owner.address, chainId: 1, nonce }
      const signature = await owner.sign({
        hash: hashAuthorization(candidate),
      })
      if (parseSignature(signature).yParity === 1) {
        authorization = candidate
        paritySignature = signature
        break
      }
    }
    if (!authorization || !paritySignature) {
      throw new Error('Could not produce a yParity=1 test signature')
    }

    const client = {
      getUserWallet: vi.fn(async () => ({ walletAddresses: [owner.address] })),
      sign7702Authorization: vi.fn(async () => paritySignature),
    } as unknown as ZeroDevWalletClient
    const account = await toViemAccount({ ...base, client })
    if (!account.signAuthorization) {
      throw new Error('Expected account to support EIP-7702 authorization')
    }

    await expect(
      account.signAuthorization({
        contractAddress: authorization.address,
        chainId: authorization.chainId,
        nonce: authorization.nonce,
      }),
    ).resolves.toMatchObject({ yParity: 1 })
  })
})
