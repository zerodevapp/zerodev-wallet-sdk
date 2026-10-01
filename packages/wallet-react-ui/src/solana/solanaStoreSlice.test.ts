/**
 * @vitest-environment happy-dom
 */
import type { WalletAccount } from '@wallet-standard/base'
import type { StandardEventsChangeProperties } from '@wallet-standard/features'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createStore } from '../store'
import type { SolanaStandardWallet } from './types'

const SOL_ADDRESS = '7S3P4HxJpyyigGzodYwHtCxZyUQe9JiBMHyRWXArAaKv'

function account(
  address = SOL_ADDRESS,
  chains: readonly string[] = ['solana:mainnet', 'solana:devnet'],
): WalletAccount {
  return {
    address,
    publicKey: new Uint8Array(32).fill(7),
    chains: chains as WalletAccount['chains'],
    features: ['solana:signTransaction'],
  }
}

/** A minimal Wallet Standard wallet: connect resolves `accounts`, events
 * are captured so a test can fire `change`. */
function fakeWallet(
  name: string,
  accounts: readonly WalletAccount[],
  options: { withEvents?: boolean; withDisconnect?: boolean } = {},
) {
  const connect = vi.fn(async () => ({ accounts }))
  const disconnect = vi.fn(async () => {})
  let listener: ((p: StandardEventsChangeProperties) => void) | null = null
  const off = vi.fn()
  const wallet = {
    version: '1.0.0',
    name,
    icon: 'data:image/svg+xml;base64,',
    chains: ['solana:mainnet', 'solana:devnet'],
    accounts,
    features: {
      'standard:connect': { version: '1.0.0', connect },
      ...(options.withDisconnect !== false && {
        'standard:disconnect': { version: '1.0.0', disconnect },
      }),
      ...(options.withEvents !== false && {
        'standard:events': {
          version: '1.0.0',
          on: (_event: 'change', l: typeof listener) => {
            listener = l
            return off
          },
        },
      }),
    },
  } as unknown as SolanaStandardWallet
  return {
    wallet,
    connect,
    disconnect,
    off,
    /** Fire `change`. Real wallets update their own `accounts` before
     * emitting; pass `partial: true` to model a multichain wallet emitting a
     * list for another namespace without touching the Solana accounts. */
    emitChange: (
      p: StandardEventsChangeProperties,
      { partial = false }: { partial?: boolean } = {},
    ) => {
      if (!partial && p.accounts) {
        ;(wallet as { accounts: readonly WalletAccount[] }).accounts =
          p.accounts
      }
      listener?.(p)
    },
  }
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('solana store slice', () => {
  it('connects, picks the Solana account and remembers the wallet', async () => {
    const store = createStore()
    const evmLooking = account(`0x${'a'.repeat(40)}`, ['eip155:1'])
    const { wallet, connect } = fakeWallet('Phantom', [evmLooking, account()])

    const connection = await store.getState().solana.connect(wallet)

    expect(connect).toHaveBeenCalledWith(undefined)
    expect(connection.address).toBe(SOL_ADDRESS)
    expect(connection.chains).toEqual(['solana:mainnet', 'solana:devnet'])
    expect(connection.source).toBe('standard')
    expect(store.getState().solana.status).toBe('connected')
    expect(store.getState().solana.connection?.wallet).toBe(wallet)
    expect(window.localStorage.getItem('zerodev:solana:lastWallet')).toBe(
      'Phantom',
    )
  })

  it('rejects a wallet that authorises no Solana account', async () => {
    const store = createStore()
    const { wallet } = fakeWallet('Odd', [
      account(`0x${'b'.repeat(40)}`, ['eip155:1']),
    ])
    await expect(store.getState().solana.connect(wallet)).rejects.toThrow(
      /did not authorise a Solana account/,
    )
    expect(store.getState().solana.status).toBe('disconnected')
    expect(store.getState().solana.connection).toBeNull()
  })

  it('disconnects: clears the slot, forgets the wallet, tells the wallet', async () => {
    const store = createStore()
    const { wallet, disconnect, off } = fakeWallet('Solflare', [account()])
    await store.getState().solana.connect(wallet)

    await store.getState().solana.disconnect()

    expect(store.getState().solana.status).toBe('disconnected')
    expect(store.getState().solana.connection).toBeNull()
    expect(disconnect).toHaveBeenCalledTimes(1)
    expect(off).toHaveBeenCalledTimes(1)
    expect(window.localStorage.getItem('zerodev:solana:lastWallet')).toBeNull()
  })

  it('follows account changes and treats an empty account list as disconnect', async () => {
    const store = createStore()
    const { wallet, emitChange } = fakeWallet('Backpack', [account()])
    await store.getState().solana.connect(wallet)

    const other = 'DRpbCBMxVnDK7maPM5tGv6MvB3v1sRMC86PZ8okm21hy'
    emitChange({ accounts: [account(other)] })
    expect(store.getState().solana.connection?.address).toBe(other)

    emitChange({ accounts: [] })
    expect(store.getState().solana.status).toBe('disconnected')
    expect(store.getState().solana.connection).toBeNull()
  })

  it("ignores a change event carrying only another namespace's accounts", async () => {
    const store = createStore()
    const { wallet, emitChange } = fakeWallet('Phantom', [account()])
    await store.getState().solana.connect(wallet)

    // Phantom emits its EVM account list when the Ethereum side changes.
    emitChange(
      { accounts: [account(`0x${'c'.repeat(40)}`, ['eip155:1'])] },
      { partial: true },
    )

    expect(store.getState().solana.status).toBe('connected')
    expect(store.getState().solana.connection?.address).toBe(SOL_ADDRESS)
  })

  it('restores the last wallet silently, and only that one', async () => {
    const store = createStore()
    window.localStorage.setItem('zerodev:solana:lastWallet', 'Phantom')
    const phantom = fakeWallet('Phantom', [account()])
    const solflare = fakeWallet('Solflare', [account()])

    await store.getState().solana.restore([solflare.wallet, phantom.wallet])

    expect(phantom.connect).toHaveBeenCalledWith({ silent: true })
    expect(solflare.connect).not.toHaveBeenCalled()
    expect(store.getState().solana.connection?.wallet).toBe(phantom.wallet)
  })

  it('restore is a no-op without a stored wallet or when it is absent', async () => {
    const store = createStore()
    const phantom = fakeWallet('Phantom', [account()])
    await store.getState().solana.restore([phantom.wallet])
    expect(phantom.connect).not.toHaveBeenCalled()

    window.localStorage.setItem('zerodev:solana:lastWallet', 'Solflare')
    await store.getState().solana.restore([phantom.wallet])
    expect(phantom.connect).not.toHaveBeenCalled()
    expect(store.getState().solana.status).toBe('disconnected')
  })

  it('swallows a failed silent restore', async () => {
    const store = createStore()
    window.localStorage.setItem('zerodev:solana:lastWallet', 'Phantom')
    const phantom = fakeWallet('Phantom', [account()])
    phantom.connect.mockRejectedValueOnce(new Error('not authorised'))

    await expect(
      store.getState().solana.restore([phantom.wallet]),
    ).resolves.toBeUndefined()
    expect(store.getState().solana.status).toBe('disconnected')
  })
})
