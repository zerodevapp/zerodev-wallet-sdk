import { useEffect } from 'react'
import { useKitStore } from '../../shared/hooks/useKitStore'
import { readLastSolanaWallet } from '../solanaStoreSlice'
import { useSolanaWalletConnect } from './useSolanaWalletConnect'
import { useSolanaWallets } from './useSolanaWallets'

/**
 * Silently reconnect the Solana wallet used last time, once it is available.
 * Internal: `useZeroDevWalletKit` mounts it (its `reconnectOnMount`), and so
 * does the `SignUp` root, so a reload that lands on sign-up restores too.
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
  const wantsWalletConnect =
    enabled && readLastSolanaWallet()?.source === 'walletconnect'
  const {
    enabled: walletConnectEnabled,
    wallet: walletConnect,
    error: walletConnectError,
  } = useSolanaWalletConnect(wantsWalletConnect)
  useEffect(() => {
    if (!enabled) return
    const { solana } = store.getState()
    // Every path below ends the restore (`restoreSettled`), so a host holding
    // a "signed out" redirect on `isReconnecting` is released: the saved
    // wallet is gone, its door is not configured, or the attempt has run.
    if (wantsWalletConnect) {
      if (!walletConnectEnabled || walletConnectError) {
        solana.settleRestore()
        return
      }
      // The provider is still loading; the restore stays pending until it
      // has a wallet to try (a restore without it would settle too early).
      if (!walletConnect) return
      solana.restore([walletConnect])
      return
    }
    // restore() never rejects: a failed silent reconnect is just "not connected".
    solana.restore(wallets)
  }, [
    enabled,
    store,
    wallets,
    wantsWalletConnect,
    walletConnectEnabled,
    walletConnect,
    walletConnectError,
  ])
}
