import { useEffect } from 'react'
import { useKitStore } from '../../shared/hooks/useKitStore'
import { useSolanaWalletConnect } from './useSolanaWalletConnect'
import { useSolanaWallets } from './useSolanaWallets'

/**
 * Silently reconnect the Solana wallet used last time, once it is available.
 * Mount it once near the root of the host app (or rely on
 * `SignUp.InstalledWallets` with a `solana` namespace, which mounts it too).
 * Wallet Standard wallets keep
 * no session of their own, so this is how a Solana connection survives a
 * reload: `standard:connect({ silent: true })` returns the accounts the
 * wallet still authorises for this origin, without a prompt. A WalletConnect
 * session persists in the SDK's storage; the same silent connect reads it
 * back once the provider has loaded.
 */
export function useSolanaAutoReconnect(): void {
  const store = useKitStore()
  const wallets = useSolanaWallets()
  const { wallet: walletConnect } = useSolanaWalletConnect()
  useEffect(() => {
    const candidates = walletConnect ? [...wallets, walletConnect] : wallets
    if (candidates.length === 0) return
    // restore() never rejects: a failed silent reconnect is just "not connected".
    store.getState().solana.restore(candidates)
  }, [store, wallets, walletConnect])
}
