import type {
  SolanaSignAndSendTransactionFeature,
  SolanaSignMessageFeature,
  SolanaSignTransactionFeature,
} from '@solana/wallet-standard-features'
import { describe, expect, it, vi } from 'vitest'
import type { SolanaStandardWallet } from '../types'
import { SOLANA_CAIP2 } from './chains'
import { fakeWcProvider, fakeWcSession } from './fakeProvider.fixture'
import { base58, base64 } from './transaction'
import {
  getSolanaWalletConnectWallet,
  providerOfSolanaWalletConnectWallet,
} from './wallet'

/** The signing features the WalletConnect wallet adds beyond the base type. */
const signing = (wallet: SolanaStandardWallet) =>
  wallet.features as unknown as SolanaSignMessageFeature &
    SolanaSignTransactionFeature &
    SolanaSignAndSendTransactionFeature

const PUBKEY = new Uint8Array(32).fill(7)
const ADDRESS = base58.encode(PUBKEY)
const mainnet = (address = ADDRESS) => `${SOLANA_CAIP2.mainnet}:${address}`

/** A wallet whose session holds one mainnet account. */
function connected(session = fakeWcSession([mainnet()])) {
  const provider = fakeWcProvider(session)
  const wallet = getSolanaWalletConnectWallet(provider)
  const [account] = wallet.accounts
  if (!account) throw new Error('fixture has no account')
  return { provider, wallet, account }
}

describe('getSolanaWalletConnectWallet', () => {
  it('is one wallet per provider, marked as WalletConnect-sourced', () => {
    const provider = fakeWcProvider()
    const wallet = getSolanaWalletConnectWallet(provider)
    expect(getSolanaWalletConnectWallet(provider)).toBe(wallet)
    expect(wallet.source).toBe('walletconnect')
    expect(providerOfSolanaWalletConnectWallet(wallet)).toBe(provider)
  })

  it('reads name, icon and accounts from the session, merging chains per address', () => {
    const { wallet, account } = connected(
      fakeWcSession([
        mainnet(),
        `${SOLANA_CAIP2.deprecatedMainnet}:${ADDRESS}`,
        `${SOLANA_CAIP2.devnet}:${ADDRESS}`,
        'eip155:1:0xabc',
      ]),
    )
    expect(wallet.name).toBe('Phantom')
    expect(wallet.icon).toBe('https://phantom.app/icon.png')
    expect(wallet.accounts).toHaveLength(1)
    expect(account.address).toBe(ADDRESS)
    expect(new Uint8Array(account.publicKey)).toEqual(PUBKEY)
    expect(account.chains).toEqual(['solana:mainnet', 'solana:devnet'])
    expect(account.features).toEqual([
      'solana:signMessage',
      'solana:signTransaction',
      'solana:signAndSendTransaction',
    ])
  })

  it('advertises only the features the wallet approved', () => {
    const { account } = connected(
      fakeWcSession([mainnet()], {
        methods: ['solana_signMessage', 'solana_signTransaction'],
      }),
    )
    expect(account.features).toEqual([
      'solana:signMessage',
      'solana:signTransaction',
    ])
  })

  it('falls back to a generic name and logo without a session', () => {
    const wallet = getSolanaWalletConnectWallet(fakeWcProvider())
    expect(wallet.name).toBe('WalletConnect')
    expect(wallet.icon.startsWith('data:')).toBe(true)
    expect(wallet.accounts).toEqual([])
  })

  it('connect proposes a solana session when there is none, silent refuses', async () => {
    const provider = fakeWcProvider()
    provider.connect.mockImplementation(async () => {
      provider.session = fakeWcSession([mainnet()])
    })
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
            SOLANA_CAIP2.deprecatedDevnet,
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

  it('names the namespaces a wallet approved when none is Solana', async () => {
    const provider = fakeWcProvider()
    provider.connect.mockImplementation(async () => {
      provider.session = {
        namespaces: { eip155: { accounts: ['eip155:1:0xabc'] } },
        peer: { metadata: { name: 'MetaMask' } },
      }
    })
    await expect(
      getSolanaWalletConnectWallet(provider).features[
        'standard:connect'
      ].connect(),
    ).rejects.toThrow('MetaMask approved eip155 but no Solana account')
  })

  it('relays signMessage as solana_signMessage on the id the wallet approved', async () => {
    const { provider, wallet, account } = connected(
      fakeWcSession([`${SOLANA_CAIP2.deprecatedMainnet}:${ADDRESS}`]),
    )
    const sig = new Uint8Array(64).fill(3)
    provider.request.mockResolvedValueOnce({ signature: base58.encode(sig) })
    const message = new TextEncoder().encode('hi')
    const [out] = await signing(wallet)['solana:signMessage'].signMessage({
      account,
      message,
    })
    expect(provider.request).toHaveBeenCalledWith(
      {
        method: 'solana_signMessage',
        params: { message: base58.encode(message), pubkey: ADDRESS },
      },
      SOLANA_CAIP2.deprecatedMainnet,
    )
    expect(out?.signature).toEqual(sig)
    expect(out?.signedMessage).toBe(message)
  })

  it('signTransaction takes the returned transaction, or splices the signature', async () => {
    const { provider, wallet, account } = connected()
    const feature = signing(wallet)['solana:signTransaction']
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

    const signedByWallet = new Uint8Array([9, 9, 9])
    provider.request.mockResolvedValueOnce({
      signature: 'x',
      transaction: base64.encode(signedByWallet),
    })
    let [out] = await feature.signTransaction({
      account,
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
    ;[out] = await feature.signTransaction({ account, transaction: tx })
    expect(out?.signedTransaction.subarray(1, 65)).toEqual(sig)
    expect(out?.signedTransaction.subarray(65)).toEqual(tx.subarray(65))
  })

  it('refuses a chain the session does not include', async () => {
    const { wallet, account } = connected()
    await expect(
      signing(wallet)['solana:signAndSendTransaction'].signAndSendTransaction({
        account,
        transaction: new Uint8Array([1]),
        chain: 'solana:devnet',
      }),
    ).rejects.toThrow('does not include solana:devnet')
  })

  it('signAndSendTransaction forwards send options and decodes the signature', async () => {
    const { provider, wallet, account } = connected(
      fakeWcSession([`${SOLANA_CAIP2.devnet}:${ADDRESS}`]),
    )
    const sig = new Uint8Array(64).fill(8)
    provider.request.mockResolvedValueOnce({ signature: base58.encode(sig) })
    const tx = new Uint8Array([2, 2])
    const [out] = await signing(wallet)[
      'solana:signAndSendTransaction'
    ].signAndSendTransaction({
      account,
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
    const { provider, wallet } = connected()
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
