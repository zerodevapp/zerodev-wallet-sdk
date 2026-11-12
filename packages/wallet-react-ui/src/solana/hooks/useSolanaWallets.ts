import { useSyncExternalStore } from 'react'
import {
  getServerSolanaWallets,
  getSolanaWallets,
  subscribeSolanaWallets,
} from '../registry'
import type { SolanaStandardWallet } from '../types'

/**
 * Solana-capable wallets announced through the Wallet Standard registry
 * (Phantom, Solflare, Backpack, … browser extensions). Live: wallets that
 * register after first render appear without a reload. Always empty during
 * server rendering.
 */
export function useSolanaWallets(): readonly SolanaStandardWallet[] {
  return useSyncExternalStore(
    subscribeSolanaWallets,
    getSolanaWallets,
    getServerSolanaWallets,
  )
}
