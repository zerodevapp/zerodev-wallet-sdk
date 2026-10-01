import { isSolanaChain, type SolanaChain } from '@solana/wallet-standard-chains'
import type { WalletAccount } from '@wallet-standard/base'
import type { StateCreator } from 'zustand'
import type {
  SolanaConnection,
  SolanaConnectionStatus,
  SolanaStandardWallet,
} from './types'

const LAST_WALLET_STORAGE_KEY = 'zerodev:solana:lastWallet'

function readLastWalletName(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(LAST_WALLET_STORAGE_KEY)
  } catch {
    return null
  }
}

function writeLastWalletName(name: string | null): void {
  if (typeof window === 'undefined') return
  try {
    if (name === null) window.localStorage.removeItem(LAST_WALLET_STORAGE_KEY)
    else window.localStorage.setItem(LAST_WALLET_STORAGE_KEY, name)
  } catch {
    // Storage unavailable — the session just won't restore after a reload.
  }
}

/** The account to use: the first one the wallet authorised for a Solana
 * chain. Wallets that serve several namespaces (Phantom) may list accounts
 * for other chains too. */
function pickSolanaAccount(
  accounts: readonly WalletAccount[],
): WalletAccount | undefined {
  return accounts.find((a) => a.chains.some(isSolanaChain))
}

function toConnection(
  wallet: SolanaStandardWallet,
  account: WalletAccount,
): SolanaConnection {
  return {
    source: 'standard',
    wallet,
    account,
    address: account.address,
    publicKey: new Uint8Array(account.publicKey),
    chains: account.chains.filter(isSolanaChain) as SolanaChain[],
  }
}

export interface SolanaStoreSlice {
  solana: {
    status: SolanaConnectionStatus
    /** The connected wallet, or null. One Solana wallet at a time,
     * independent of the EVM (wagmi) connection. */
    connection: SolanaConnection | null
    /**
     * Connect a Wallet Standard wallet. Prompts the wallet unless `silent`
     * is set, in which case the wallet returns only already-authorised
     * accounts (used to restore after a reload). Replaces any existing
     * Solana connection.
     */
    connect: (
      wallet: SolanaStandardWallet,
      options?: { silent?: boolean },
    ) => Promise<SolanaConnection>
    disconnect: () => Promise<void>
    /**
     * Silently reconnect the wallet used last time, if it is among `wallets`.
     * No-op when nothing was stored, the wallet is absent, or already
     * connected. Errors are swallowed: a failed restore is just "not
     * connected".
     */
    restore: (wallets: readonly SolanaStandardWallet[]) => Promise<void>
  }
}

export const createSolanaStoreSlice: StateCreator<
  SolanaStoreSlice,
  [],
  [],
  SolanaStoreSlice
> = (set, get) => {
  // The wallet's `standard:events` unsubscribe. Outside the state: it is
  // plumbing, not something components read.
  let offEvents: (() => void) | null = null

  const clear = () => {
    offEvents?.()
    offEvents = null
    set((state) => ({
      solana: { ...state.solana, status: 'disconnected', connection: null },
    }))
  }

  const watch = (wallet: SolanaStandardWallet) => {
    offEvents?.()
    offEvents =
      wallet.features['standard:events']?.on('change', ({ accounts }) => {
        if (!accounts) return
        // Multichain wallets (Phantom) announce Solana, EVM, Bitcoin and Sui
        // accounts under one Wallet Standard wallet and may emit a `change`
        // for another namespace's accounts. Read the wallet's own account
        // list first, then the event payload, so such an event never reads
        // as "Solana revoked".
        const account =
          pickSolanaAccount(wallet.accounts) ?? pickSolanaAccount(accounts)
        if (account) {
          set((state) => ({
            solana: {
              ...state.solana,
              connection: toConnection(wallet, account),
            },
          }))
          return
        }
        if (accounts.length === 0) {
          // The wallet revoked every account — that is a disconnect.
          clear()
          writeLastWalletName(null)
        }
        // Non-empty list without a Solana account: another namespace changed;
        // the Solana connection stands.
      }) ?? null
  }

  return {
    solana: {
      status: 'disconnected',
      connection: null,

      connect: async (wallet, options) => {
        set((state) => ({ solana: { ...state.solana, status: 'connecting' } }))
        try {
          const { accounts } = await wallet.features[
            'standard:connect'
          ].connect(options?.silent ? { silent: true } : undefined)
          const account = pickSolanaAccount(accounts)
          if (!account) {
            throw new Error(
              `${wallet.name} did not authorise a Solana account.`,
            )
          }
          const connection = toConnection(wallet, account)
          watch(wallet)
          writeLastWalletName(wallet.name)
          set((state) => ({
            solana: { ...state.solana, status: 'connected', connection },
          }))
          return connection
        } catch (error) {
          // Keep a previous connection if the new attempt failed, otherwise
          // fall back to disconnected.
          set((state) => ({
            solana: {
              ...state.solana,
              status: state.solana.connection ? 'connected' : 'disconnected',
            },
          }))
          throw error
        }
      },

      disconnect: async () => {
        const { connection } = get().solana
        writeLastWalletName(null)
        clear()
        try {
          await connection?.wallet.features['standard:disconnect']?.disconnect()
        } catch {
          // The wallet may refuse or lack the feature; our side is already
          // cleared, which is what the host observes.
        }
      },

      restore: async (wallets) => {
        const { status } = get().solana
        if (status !== 'disconnected') return
        const name = readLastWalletName()
        if (!name) return
        const wallet = wallets.find((w) => w.name === name)
        if (!wallet) return
        try {
          await get().solana.connect(wallet, { silent: true })
        } catch {
          // Not authorised any more (or the wallet ignores `silent`): the
          // user connects again by hand.
        }
      },
    },
  }
}
