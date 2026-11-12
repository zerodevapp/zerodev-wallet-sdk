import { useEffect, useState } from 'react'
import { useConfig } from 'wagmi'
import { useKitStore } from '../../shared/hooks/useKitStore'
import { guardDormantEvmSide } from '../evmAdoptionGuard'
import {
  readLastSolanaWallet,
  type SolanaRestoreOutcome,
} from '../solanaStoreSlice'
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
/** How long a saved Wallet Standard wallet gets to announce itself before
 * the restore gives up on it: late `register` events, and SSR hydration,
 * where the registry first reports its empty server snapshot. */
const ANNOUNCE_GRACE_MS = 1500

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
  const config = useConfig()
  // The EVM connections wagmi had persisted when the page loaded: the ones
  // the host held on purpose. The kit connector takes that record inside
  // wagmi's config creation, the only point where it can still be read
  // (wagmi overwrites it right after, and its reload reconnect rebuilds the
  // state from the wallets instead).
  const [restoredEvm] = useState(() => store.getState().evmConnectionsAtLoad)
  // The EVM side a multichain wallet granted alongside the saved Solana
  // session must not come back on its own. Mounted once per hook instance:
  // the guard follows connectors that arrive later by itself (under `ssr`
  // wagmi sets the EIP-6963 connectors up in its mount effect, after this
  // one). Another instance, or a remount, is safe: the guard judges the
  // reload sweep once per page load, so the host's later EVM connections
  // are never measured against the load-time record. Only an installed
  // wallet has an EVM side wagmi could adopt.
  useEffect(() => {
    if (!enabled) return
    const last = readLastSolanaWallet()
    if (last?.source !== 'standard') return
    return guardDormantEvmSide(config, last.name, restoredEvm)
  }, [enabled, config, restoredEvm])
  useEffect(() => {
    if (!enabled) return
    const { solana } = store.getState()
    // Every path below ends the restore (`restoreSettled`), so a host holding
    // a "signed out" redirect on `isReconnecting` is released: the saved
    // wallet is gone, its door is not configured, or the attempt has run. A
    // saved wallet that has not announced yet gets a grace period first; a
    // re-run of this effect (it did announce) cancels the timer and tries.
    let disposed = false
    let graceTimer: ReturnType<typeof setTimeout> | undefined
    const settleUnlessAnnounced = (outcome: SolanaRestoreOutcome) => {
      if (disposed || outcome !== 'wallet-absent') return
      graceTimer = setTimeout(() => solana.settleRestore(), ANNOUNCE_GRACE_MS)
    }
    if (wantsWalletConnect) {
      if (!walletConnectEnabled || walletConnectError) {
        solana.settleRestore()
        return
      }
      // The provider is still loading; the restore stays pending until it
      // has a wallet to try (a restore without it would settle too early).
      if (!walletConnect) return
      solana.restore([walletConnect]).then(settleUnlessAnnounced)
    } else {
      // restore() never rejects: a failed silent reconnect is just "not connected".
      solana.restore(wallets).then(settleUnlessAnnounced)
    }
    return () => {
      disposed = true
      clearTimeout(graceTimer)
    }
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
