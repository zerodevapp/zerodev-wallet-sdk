import { useEffect } from 'react'
import { useKitStore } from '../../shared/hooks/useKitStore'
import { readLastSolanaWallet } from '../solanaStoreSlice'
import { useSolanaWalletConnect } from './useSolanaWalletConnect'
import { useSolanaWallets } from './useSolanaWallets'

/**
 * Silently reconnect the Solana wallet used last time, once it is available.
 * Internal: `useZeroDevWalletKit` mounts it (its `reconnectOnMount`), and so
 * do the Solana sign-up units (`SignUp.InstalledWallets` with a `solana`
 * namespace, `SignUp.SolanaWalletConnect`), so a reload that lands on a
 * sheet offering Solana restores too, and a sheet without one restores
 * nothing.
 * Wallet Standard wallets keep
 * no session of their own, so this is how a Solana connection survives a
 * reload: `standard:connect({ silent: true })` returns the accounts the
 * wallet still authorises for this origin, without a prompt. A WalletConnect
 * session persists in the SDK's storage; the provider is loaded, and the
 * same silent connect reads the session back, only when the last connection
 * was one.
 *
 * @param enabled - `false` leaves the Solana slot alone (nothing is loaded
 * or restored); the hook can then stay mounted unconditionally.
 */
export function useSolanaAutoReconnect(enabled = true): void {
  const store = useKitStore()
  const wallets = useSolanaWallets()
  const { wallet: walletConnect } = useSolanaWalletConnect(
    enabled && readLastSolanaWallet()?.source === 'walletconnect',
  )
  useEffect(() => {
    if (!enabled) return
    const candidates = walletConnect ? [...wallets, walletConnect] : wallets
    if (candidates.length === 0) return
    // restore() never rejects: a failed silent reconnect is just "not connected".
    store.getState().solana.restore(candidates)
  }, [enabled, store, wallets, walletConnect])
}
