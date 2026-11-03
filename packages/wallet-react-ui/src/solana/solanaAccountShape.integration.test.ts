/**
 * @vitest-environment happy-dom
 *
 * OPEN QUESTION: should the solana slot refuse an account it cannot use or is
 * trusting the wallet ok?
 *
 */
import type { WalletAccount } from '@wallet-standard/base'
import { describe, expect, it, vi } from 'vitest'
import { createStore } from '../store'
import type { SolanaStandardWallet } from './types'
import { parseSessionAccount } from './walletconnect/chains'
import { base58 } from './walletconnect/transaction'

const ADDRESS = '7S3P4HxJpyyigGzodYwHtCxZyUQe9JiBMHyRWXArAaKv'

/** A wallet whose one Solana account is whatever the probe hands it. The
 * overrides are untyped because `WalletAccount` requires `publicKey`, so a
 * conforming wallet cannot omit it — only a misbehaving one gets here. */
function walletAnswering(account: Record<string, unknown>) {
  const answer = {
    address: ADDRESS,
    publicKey: new Uint8Array(32).fill(7),
    chains: ['solana:mainnet'],
    features: ['solana:signMessage'],
    ...account,
  } as WalletAccount
  return {
    version: '1.0.0',
    name: 'Probe',
    icon: 'data:image/svg+xml;base64,',
    chains: ['solana:mainnet'],
    accounts: [answer],
    features: {
      'standard:connect': {
        version: '1.0.0',
        connect: vi.fn(async () => ({ accounts: [answer] })),
      },
    },
  } as unknown as SolanaStandardWallet
}

const connect = (account: Record<string, unknown>) =>
  createStore().getState().solana.connect(walletAnswering(account))

describe('an installed wallet answering with an unusable account', () => {
  // `new Uint8Array(undefined)` is a zero-length array, not a throw.
  it.fails('refuses an account with no public key', async () => {
    await expect(connect({ publicKey: undefined })).rejects.toThrow()
  })

  // A Solana public key is 32 bytes. `toConnection` copies whatever length
  // it is given.
  it.fails('refuses a public key that is not 32 bytes', async () => {
    await expect(connect({ publicKey: new Uint8Array(16) })).rejects.toThrow()
  })

  // `pickSolanaAccount` selects on `chains` alone, so the address is never
  // looked at.
  it.fails('refuses an account with an empty address', async () => {
    await expect(connect({ address: '' })).rejects.toThrow()
  })
})

/**
 * The WalletConnect route reaches the same place by another path. `accountsOf`
 * is not exported, so this traces the two exported pieces it composes: a
 * session account is `solana:<reference>:<base58 pubkey>`, and the third part
 * goes straight to `base58.decode` as the public key.
 */
describe('a WalletConnect session account', () => {
  it.fails('refuses one with an empty address', () => {
    expect(parseSessionAccount('solana:mainnet:')).toBeUndefined()
  })

  // `base58.decode` throws on an unknown letter, so a garbled address breaks
  // cleanly. It says nothing about length, and nothing upstream checks.
  it.fails('decodes an address to a 32-byte key or not at all', () => {
    const parsed = parseSessionAccount('solana:mainnet:abc')
    expect(base58.decode(parsed?.address ?? '')).toHaveLength(32)
  })
})
