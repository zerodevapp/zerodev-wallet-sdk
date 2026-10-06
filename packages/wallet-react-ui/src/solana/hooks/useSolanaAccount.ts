import { useCallback, useMemo } from 'react'
import { useConfig } from 'wagmi'
import { useStore } from 'zustand'
import { useKitStore } from '../../shared/hooks/useKitStore'
import { withoutEvmAdoption } from '../evmAdoptionGuard'
import type {
  SolanaConnection,
  SolanaConnectionStatus,
  SolanaStandardWallet,
} from '../types'

export type SolanaAccount = {
  status: SolanaConnectionStatus
  isConnected: boolean
  /** Base58 address of the connected account, or undefined. */
  address: string | undefined
  publicKey: Uint8Array | undefined
  chains: SolanaConnection['chains']
  /** Where the connection came from ('standard' for a Wallet Standard
   * browser wallet), or undefined while disconnected. */
  source: SolanaConnection['source'] | undefined
  /** Name and icon of the connected wallet, for display. */
  walletName: string | undefined
  walletIcon: string | undefined
  /** Connect a Solana wallet from `useSolanaWallets()`, prompting it. For
   * hosts that add a Solana wallet after login, outside the sign-up flow
   * (an EVM-first session that later connects Solana). Connects Solana
   * only, even for a multichain wallet; replaces any existing Solana
   * connection; rejects when the user declines. */
  connect: (wallet: SolanaStandardWallet) => Promise<void>
  disconnect: () => Promise<void>
}

/**
 * Connection state of the kit's Solana wallet slot: the external Solana
 * wallet the user connected through `SignUp.SolanaWallets`. Independent of
 * the wagmi (EVM) connection, so both can be connected at once.
 *
 * Address, status, connect and disconnect are what a host like the Arbitrum
 * bridge needs from the wallet layer; signing goes through
 * `useSolanaWallet()`.
 */
export function useSolanaAccount(): SolanaAccount {
  const store = useKitStore()
  const wagmiConfig = useConfig()
  const status = useStore(store, (s) => s.solana.status)
  const connection = useStore(store, (s) => s.solana.connection)
  const disconnect = store.getState().solana.disconnect
  const connect = useCallback(
    async (wallet: SolanaStandardWallet) => {
      // Solana only: keep wagmi from adopting a multichain wallet's EVM side.
      await withoutEvmAdoption(wagmiConfig, wallet.name, () =>
        store.getState().solana.connect(wallet),
      )
    },
    [store, wagmiConfig],
  )

  return useMemo(
    () => ({
      status,
      isConnected: status === 'connected' && connection !== null,
      address: connection?.address,
      publicKey: connection?.publicKey,
      chains: connection?.chains ?? [],
      source: connection?.source,
      walletName: connection?.wallet.name,
      walletIcon: connection?.wallet.icon,
      connect,
      disconnect,
    }),
    [status, connection, connect, disconnect],
  )
}
