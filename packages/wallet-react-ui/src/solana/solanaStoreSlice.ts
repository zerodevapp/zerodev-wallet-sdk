import { isSolanaChain, type SolanaChain } from '@solana/wallet-standard-chains'
import type { WalletAccount } from '@wallet-standard/base'
import type { StateCreator } from 'zustand'
import type {
  SolanaConnection,
  SolanaConnectionSource,
  SolanaConnectionStatus,
  SolanaStandardWallet,
} from './types'

const LAST_WALLET_STORAGE_KEY = 'zerodev:solana:lastWallet'

/** What restore() needs to find the wallet again: an installed Phantom and
 * Phantom over WalletConnect share a name, so the source is stored too. */
export type LastSolanaWallet = {
  name: string
  source: SolanaConnectionSource
}

const sourceOf = (wallet: SolanaStandardWallet): SolanaConnectionSource =>
  wallet.source ?? 'standard'

/** The wallet connected last time, as persisted; null when none or unreadable. */
export function readLastSolanaWallet(): LastSolanaWallet | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(LAST_WALLET_STORAGE_KEY)
    if (!raw) return null
    let parsed: Partial<LastSolanaWallet> | null
    try {
      parsed = JSON.parse(raw)
    } catch {
      // The earlier format stored the bare name of an installed wallet; the
      // next successful connect rewrites it as a record.
      return { name: raw, source: 'standard' }
    }
    return parsed?.name
      ? { name: parsed.name, source: parsed.source ?? 'standard' }
      : null
  } catch {
    return null
  }
}

function writeLastWallet(last: LastSolanaWallet | null): void {
  if (typeof window === 'undefined') return
  try {
    if (last === null) window.localStorage.removeItem(LAST_WALLET_STORAGE_KEY)
    else
      window.localStorage.setItem(LAST_WALLET_STORAGE_KEY, JSON.stringify(last))
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
    source: sourceOf(wallet),
    wallet,
    account,
    address: account.address,
    publicKey: new Uint8Array(account.publicKey),
    chains: account.chains.filter(isSolanaChain) as SolanaChain[],
  }
}

/** What `restore` did. Only `nothing-saved` and `attempted` end the restore;
 * `wallet-absent` leaves it open for the caller, because a Wallet Standard
 * wallet may still announce itself (late registration, SSR hydration from
 * the registry's empty server snapshot). */
export type SolanaRestoreOutcome =
  | 'nothing-saved'
  | 'wallet-absent'
  | 'attempted'
  | 'already-connected'

export interface SolanaStoreSlice {
  solana: {
    status: SolanaConnectionStatus
    /** The connected wallet, or null. One Solana wallet at a time,
     * independent of the EVM (wagmi) connection. */
    connection: SolanaConnection | null
    /**
     * True once a restore attempt has run to an end this page load, in any
     * outcome: connected, refused, nothing stored, wallet absent, or the
     * WalletConnect provider failed to load. Until then a saved session may
     * still come back, and `useZeroDevWalletKit` reports it as reconnecting.
     */
    restoreSettled: boolean
    /** Mark the restore as over without an attempt (the saved wallet cannot
     * be reached, for example its WalletConnect door is not configured). */
    settleRestore: () => void
    /**
     * Connect a Wallet Standard wallet. Prompts the wallet unless `silent`
     * is set, in which case the wallet returns only already-authorised
     * accounts (used to restore after a reload). Replaces any existing
     * Solana connection. An aborted `signal` turns a late answer from the
     * wallet into a rejection (`AbortError`) instead of a connection: the
     * session the wallet made is ended and nothing is committed or stored.
     */
    connect: (
      wallet: SolanaStandardWallet,
      options?: { silent?: boolean; signal?: AbortSignal },
    ) => Promise<SolanaConnection>
    disconnect: () => Promise<void>
    /**
     * Silently reconnect the wallet used last time, if it is among `wallets`
     * (installed Wallet Standard wallets, plus the WalletConnect wallet when
     * a session survived the reload). No-op when nothing was stored, the
     * wallet is absent, or already connected. Errors are swallowed: a failed
     * restore is just "not connected". Settles the restore itself except
     * when the saved wallet is absent, which the caller settles after giving
     * it time to announce.
     */
    restore: (
      wallets: readonly SolanaStandardWallet[],
    ) => Promise<SolanaRestoreOutcome>
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
  // Connection attempts, numbered. A connect commits only if it is still the
  // latest attempt when the wallet answers: a disconnect (logout) or a newer
  // connect in between makes the older answer stale, and a stale answer must
  // not land as a connection, write the saved session, or flip the status.
  let attempt = 0
  // The wallet the latest attempt is for, or null after a disconnect. A stale
  // answer ends its session on the wallet's side unless a newer attempt owns
  // that same wallet: the wallet's disconnect is wallet-wide and would take
  // the newer session down with it.
  let attemptWallet: SolanaStandardWallet | null = null

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
        // for another namespace's accounts only. Read the wallet's own
        // account list first, then the event payload, so such an event never
        // reads as "Solana revoked". No Solana account on either list means
        // the wallet dropped it (alone, or with everything): a disconnect.
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
        clear()
        writeLastWallet(null)
      }) ?? null
  }

  return {
    solana: {
      status: 'disconnected',
      connection: null,
      restoreSettled: false,

      settleRestore: () => {
        if (get().solana.restoreSettled) return
        set((state) => ({ solana: { ...state.solana, restoreSettled: true } }))
      },

      connect: async (wallet, options) => {
        const mine = ++attempt
        attemptWallet = wallet
        set((state) => ({
          solana: {
            ...state.solana,
            status: options?.silent ? 'reconnecting' : 'connecting',
          },
        }))
        try {
          const { accounts } = await wallet.features[
            'standard:connect'
          ].connect(options?.silent ? { silent: true } : undefined)
          if (mine !== attempt || options?.signal?.aborted) {
            // Stale: the caller left (a closed pairing sheet), the user
            // logged out, or a newer connect started while the wallet was
            // answering. Its answer may have made a session on the wallet's
            // side, so end it, unless a newer attempt on the same wallet now
            // owns that session; a connection nobody asked for must not land.
            const ownedByNewer = mine !== attempt && attemptWallet === wallet
            if (!ownedByNewer) {
              await wallet.features['standard:disconnect']
                ?.disconnect()
                .catch(() => {})
            }
            throw new DOMException('Solana connect aborted', 'AbortError')
          }
          const account = pickSolanaAccount(accounts)
          if (!account) {
            throw new Error(
              `${wallet.name} did not authorise a Solana account.`,
            )
          }
          const connection = toConnection(wallet, account)
          watch(wallet)
          writeLastWallet({ name: wallet.name, source: sourceOf(wallet) })
          set((state) => ({
            solana: { ...state.solana, status: 'connected', connection },
          }))
          return connection
        } catch (error) {
          // Keep a previous connection if the new attempt failed, otherwise
          // fall back to disconnected. A stale attempt leaves the status to
          // whatever superseded it.
          if (mine === attempt) {
            set((state) => ({
              solana: {
                ...state.solana,
                status: state.solana.connection ? 'connected' : 'disconnected',
              },
            }))
          }
          throw error
        }
      },

      disconnect: async () => {
        attempt++
        attemptWallet = null
        const { connection } = get().solana
        writeLastWallet(null)
        clear()
        try {
          await connection?.wallet.features['standard:disconnect']?.disconnect()
        } catch {
          // The wallet may refuse or lack the feature; our side is already
          // cleared, which is what the host observes.
        }
      },

      restore: async (wallets) => {
        const { status, settleRestore } = get().solana
        if (status !== 'disconnected') {
          settleRestore()
          return 'already-connected'
        }
        const last = readLastSolanaWallet()
        if (!last) {
          settleRestore()
          return 'nothing-saved'
        }
        const wallet = wallets.find(
          (w) => w.name === last.name && sourceOf(w) === last.source,
        )
        // Not settled: the wallet may still announce itself.
        if (!wallet) return 'wallet-absent'
        try {
          await get().solana.connect(wallet, { silent: true })
        } catch {
          // Not authorised any more (or the wallet ignores `silent`): the
          // user connects again by hand.
        } finally {
          settleRestore()
        }
        return 'attempted'
      },
    },
  }
}
