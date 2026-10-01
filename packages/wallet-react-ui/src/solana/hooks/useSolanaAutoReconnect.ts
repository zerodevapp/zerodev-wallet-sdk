import { useEffect } from 'react'
import { useKitStore } from '../../shared/hooks/useKitStore'
import { useSolanaWallets } from './useSolanaWallets'

/**
 * Silently reconnect the Solana wallet used last time, once it has
 * registered. Mount it once near the root of the host app (or rely on
 * `SignUp.SolanaWallets`, which mounts it too). Wallet Standard wallets keep
 * no session of their own, so this is how a Solana connection survives a
 * reload: `standard:connect({ silent: true })` returns the accounts the
 * wallet still authorises for this origin, without a prompt.
 */
export function useSolanaAutoReconnect(): void {
  const store = useKitStore()
  const wallets = useSolanaWallets()
  useEffect(() => {
    if (wallets.length === 0) return
    // restore() never rejects: a failed silent reconnect is just "not connected".
    store.getState().solana.restore(wallets)
  }, [store, wallets])
}
