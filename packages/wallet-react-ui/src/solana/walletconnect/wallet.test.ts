import type {
  SolanaSignAndSendTransactionFeature,
  SolanaSignMessageFeature,
  SolanaSignTransactionFeature,
} from '@solana/wallet-standard-features'
import { describe, expect, it, type Mock, vi } from 'vitest'
import type { SolanaStandardWallet } from '../types'
import { SOLANA_CAIP2 } from './chains'
import { base58, base64 } from './transaction'
import {
  getSolanaWalletConnectWallet,
  isSolanaWalletConnectWallet,
  providerOfSolanaWalletConnectWallet,
  type SolanaWcProvider,
  type SolanaWcSession,
} from './wallet'

/** The signing features the WalletConnect wallet adds beyond the base type. */
const signing = (wallet: SolanaStandardWallet) =>
  wallet.features as unknown as SolanaSignMessageFeature &
    SolanaSignTransactionFeature &
    SolanaSignAndSendTransactionFeature

const PUBKEY = new Uint8Array(32).fill(7)
const ADDRESS = base58.encode(PUBKEY)

function session(
  accounts: string[],
  metadata: SolanaWcSession['peer']['metadata'] = {
    name: 'Phantom',
    icons: ['https://phantom.app/icon.png'],
  },
): SolanaWcSession {
  return { namespaces: { solana: { accounts } }, peer: { metadata } }
}

function fakeProvider(initial?: SolanaWcSession) {
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>()
  const provider: SolanaWcProvider & {
    emit: (event: string, ...args: unknown[]) => void
    request: Mock<SolanaWcProvider['request']>
    connect: Mock<SolanaWcProvider['connect']>
    disconnect: Mock<SolanaWcProvider['disconnect']>
    abortPairingAttempt: Mock<() => void>
  } = {
    session: initial,
    connect: vi.fn(async () => {
      provider.session = session([`${SOLANA_CAIP2.mainnet}:${ADDRESS}`])
    }),
    disconnect: vi.fn(async () => {
      provider.session = undefined
    }),
    request: vi.fn(),
    abortPairingAttempt: vi.fn(),
    on: (event, listener) => {
      listeners.set(event, (listeners.get(event) ?? new Set()).add(listener))
    },
    off: (event, listener) => {
      listeners.get(event)?.delete(listener)
    },
    emit: (event, ...args) => {
      for (const l of listeners.get(event) ?? []) l(...args)
    },
  }
  return provider
}

describe('getSolanaWalletConnectWallet', () => {
  it('is one wallet per provider, recognisable as WalletConnect-backed', () => {
    const provider = fakeProvider()
    const wallet = getSolanaWalletConnectWallet(provider)
    expect(getSolanaWalletConnectWallet(provider)).toBe(wallet)
    expect(isSolanaWalletConnectWallet(wallet)).toBe(true)
    expect(isSolanaWalletConnectWallet({})).toBe(false)
    expect(providerOfSolanaWalletConnectWallet(wallet)).toBe(provider)
  })

  it('reads name, icon and accounts from the session, merging chains per address', () => {
    const provider = fakeProvider(
      session([
        `${SOLANA_CAIP2.mainnet}:${ADDRESS}`,
        `${SOLANA_CAIP2.deprecatedMainnet}:${ADDRESS}`,
        `${SOLANA_CAIP2.devnet}:${ADDRESS}`,
        'eip155:1:0xabc',
      ]),
    )
    const wallet = getSolanaWalletConnectWallet(provider)
    expect(wallet.name).toBe('Phantom')
    expect(wallet.icon).toBe('https://phantom.app/icon.png')
    expect(wallet.accounts).toHaveLength(1)
    const [account] = wallet.accounts
    expect(account?.address).toBe(ADDRESS)
    expect(new Uint8Array(account?.publicKey ?? [])).toEqual(PUBKEY)
    expect(account?.chains).toEqual(['solana:mainnet', 'solana:devnet'])
    expect(account?.features).toContain('solana:signMessage')
  })

  it('falls back to a generic name and logo without a session', () => {
    const wallet = getSolanaWalletConnectWallet(fakeProvider())
    expect(wallet.name).toBe('WalletConnect')
    expect(wallet.icon.startsWith('data:')).toBe(true)
    expect(wallet.accounts).toEqual([])
  })

  it('connect proposes a solana session when there is none, silent refuses', async () => {
    const provider = fakeProvider()
    const wallet = getSolanaWalletConnectWallet(provider)
    await expect(
      wallet.features['standard:connect'].connect({ silent: true }),
    ).rejects.toThrow('No WalletConnect session')
    expect(provider.connect).not.toHaveBeenCalled()

    const { accounts } = await wallet.features['standard:connect'].connect()
    expect(provider.connect).toHaveBeenCalledWith({
      optionalNamespaces: {
        solana: expect.objectContaining({
          chains: expect.arrayContaining([
            SOLANA_CAIP2.mainnet,
            SOLANA_CAIP2.devnet,
            SOLANA_CAIP2.deprecatedMainnet,
          ]),
          methods: expect.arrayContaining(['solana_signMessage']),
        }),
      },
    })
    expect(accounts[0]?.address).toBe(ADDRESS)
    // With a session, connect (silent or not) returns it without pairing.
    await wallet.features['standard:connect'].connect({ silent: true })
    expect(provider.connect).toHaveBeenCalledTimes(1)
  })

  it('relays signMessage as solana_signMessage on the session chain', async () => {
    const provider = fakeProvider(
      session([`${SOLANA_CAIP2.deprecatedMainnet}:${ADDRESS}`]),
    )
    const wallet = getSolanaWalletConnectWallet(provider)
    const sig = new Uint8Array(64).fill(3)
    provider.request.mockResolvedValueOnce({ signature: base58.encode(sig) })
    const [account] = wallet.accounts
    const message = new TextEncoder().encode('hi')
    const [out] = await signing(wallet)['solana:signMessage'].signMessage({
      account: account as never,
      message,
    })
    expect(provider.request).toHaveBeenCalledWith(
      {
        method: 'solana_signMessage',
        params: { message: base58.encode(message), pubkey: ADDRESS },
      },
      // The id the wallet approved, deprecated or not.
      SOLANA_CAIP2.deprecatedMainnet,
    )
    expect(out?.signature).toEqual(sig)
    expect(out?.signedMessage).toBe(message)
  })

  it('signTransaction takes the returned transaction, or splices the signature', async () => {
    const provider = fakeProvider(
      session([`${SOLANA_CAIP2.mainnet}:${ADDRESS}`]),
    )
    const wallet = getSolanaWalletConnectWallet(provider)
    const [account] = wallet.accounts
    const feature = signing(wallet)['solana:signTransaction']

    const signedByWallet = new Uint8Array([9, 9, 9])
    provider.request.mockResolvedValueOnce({
      signature: 'x',
      transaction: base64.encode(signedByWallet),
    })
    // 1 signature slot, then a legacy message: header (1 signer), 1 key.
    const tx = new Uint8Array([
      1,
      ...new Array(64).fill(0),
      1,
      0,
      1,
      1,
      ...PUBKEY,
      5,
    ])
    let [out] = await feature.signTransaction({
      account: account as never,
      transaction: tx,
      chain: 'solana:mainnet',
    })
    expect(out?.signedTransaction).toEqual(signedByWallet)
    expect(provider.request).toHaveBeenLastCalledWith(
      {
        method: 'solana_signTransaction',
        params: { transaction: base64.encode(tx) },
      },
      SOLANA_CAIP2.mainnet,
    )

    const sig = new Uint8Array(64).fill(4)
    provider.request.mockResolvedValueOnce({ signature: base58.encode(sig) })
    ;[out] = await feature.signTransaction({
      account: account as never,
      transaction: tx,
    })
    expect(out?.signedTransaction.subarray(1, 65)).toEqual(sig)
    expect(out?.signedTransaction.subarray(65)).toEqual(tx.subarray(65))
  })

  it('refuses a chain the session does not include', async () => {
    const provider = fakeProvider(
      session([`${SOLANA_CAIP2.mainnet}:${ADDRESS}`]),
    )
    const wallet = getSolanaWalletConnectWallet(provider)
    const [account] = wallet.accounts
    await expect(
      signing(wallet)['solana:signAndSendTransaction'].signAndSendTransaction({
        account: account as never,
        transaction: new Uint8Array([1]),
        chain: 'solana:testnet',
      }),
    ).rejects.toThrow('does not include solana:testnet')
  })

  it('signAndSendTransaction forwards send options and decodes the signature', async () => {
    const provider = fakeProvider(
      session([`${SOLANA_CAIP2.devnet}:${ADDRESS}`]),
    )
    const wallet = getSolanaWalletConnectWallet(provider)
    const [account] = wallet.accounts
    const sig = new Uint8Array(64).fill(8)
    provider.request.mockResolvedValueOnce({ signature: base58.encode(sig) })
    const tx = new Uint8Array([2, 2])
    const [out] = await signing(wallet)[
      'solana:signAndSendTransaction'
    ].signAndSendTransaction({
      account: account as never,
      transaction: tx,
      chain: 'solana:devnet',
      options: { skipPreflight: true },
    })
    expect(provider.request).toHaveBeenCalledWith(
      {
        method: 'solana_signAndSendTransaction',
        params: {
          transaction: base64.encode(tx),
          sendOptions: { skipPreflight: true },
        },
      },
      SOLANA_CAIP2.devnet,
    )
    expect(out?.signature).toEqual(sig)
  })

  it('emits change with no accounts when the session goes away', async () => {
    const provider = fakeProvider(
      session([`${SOLANA_CAIP2.mainnet}:${ADDRESS}`]),
    )
    const wallet = getSolanaWalletConnectWallet(provider)
    const listener = vi.fn()
    const off = wallet.features['standard:events']?.on('change', listener)
    provider.session = undefined
    provider.emit('session_delete')
    expect(listener).toHaveBeenCalledWith({ accounts: [] })
    off?.()
    provider.emit('session_delete')
    expect(listener).toHaveBeenCalledTimes(1)
    await wallet.features['standard:disconnect']?.disconnect()
    expect(provider.disconnect).toHaveBeenCalled()
  })
})
