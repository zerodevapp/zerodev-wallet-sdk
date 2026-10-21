import { isSolanaChain } from '@solana/wallet-standard-chains'
import { getWallets } from '@wallet-standard/app'
import type { Wallet } from '@wallet-standard/base'
import type { SolanaStandardWallet } from './types'

/**
 * Solana wallet discovery through the Wallet Standard registry.
 *
 * Browser wallets (Phantom, Solflare, Backpack, …) register themselves with
 * `wallet-standard:register-wallet`; `getWallets()` from `@wallet-standard/app`
 * answers with everything registered so far and emits `register` /
 * `unregister` for wallets that announce later. This module filters that
 * registry down to wallets usable for Solana login and exposes it as an
 * external store (stable snapshot + subscribe) for `useSyncExternalStore`.
 *
 * The registry touches `window`, so everything here is a no-op on the server.
 */

const EMPTY: readonly SolanaStandardWallet[] = Object.freeze([])

export function isSolanaStandardWallet(
  wallet: Wallet,
): wallet is SolanaStandardWallet {
  return (
    'standard:connect' in wallet.features && wallet.chains.some(isSolanaChain)
  )
}

let snapshot: readonly SolanaStandardWallet[] = EMPTY
let registryBound = false

function refresh() {
  const next = getWallets().get().filter(isSolanaStandardWallet)
  // Keep the array identity when nothing changed so React skips re-renders.
  if (
    next.length === snapshot.length &&
    next.every((w, i) => w === snapshot[i])
  ) {
    return
  }
  snapshot = Object.freeze(next)
}

/** Current Solana-capable wallets. Empty on the server. */
export function getSolanaWallets(): readonly SolanaStandardWallet[] {
  if (typeof window === 'undefined') return EMPTY
  if (!registryBound) refresh()
  return snapshot
}

/** Server snapshot for `useSyncExternalStore`: always the same empty array. */
export function getServerSolanaWallets(): readonly SolanaStandardWallet[] {
  return EMPTY
}

/**
 * Subscribe to registry changes. The listener fires after the snapshot has
 * been refreshed, so `getSolanaWallets()` inside it returns the new list.
 */
export function subscribeSolanaWallets(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const wallets = getWallets()
  registryBound = true
  refresh()
  const onChange = () => {
    refresh()
    listener()
  }
  const offRegister = wallets.on('register', onChange)
  const offUnregister = wallets.on('unregister', onChange)
  return () => {
    offRegister()
    offUnregister()
  }
}
