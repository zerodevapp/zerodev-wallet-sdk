import { useEffect, useRef } from 'react'
import { useStore } from 'zustand'
import { useKitStore } from '../../shared/hooks/useKitStore'
import { sameWalletName } from '../../shared/utils/sameWalletName'

/**
 * The slice of `@solana/wallet-adapter-react`'s `useWallet()` the sync
 * drives. Structural, so the kit takes no dependency on the adapter and the
 * same hook serves wallet-adapter 0.x and the Kit-based 3.x, which keep
 * this contract.
 */
export type SolanaWalletAdapter = {
  wallet: { adapter: { name: string } } | null
  connected: boolean
  connecting: boolean
  select: (walletName: string | null) => void
  connect: () => Promise<void>
  disconnect: () => Promise<void>
}

/**
 * Mirror the kit's Solana connection into a wallet-adapter provider, so an
 * app built on `useWallet()` keeps its signing code unchanged: after the kit
 * connects an installed wallet, select the same wallet in the adapter and
 * connect it (silently: the wallet already authorised this origin); when
 * the kit disconnects, disconnect the adapter too. A WalletConnect session
 * has no adapter counterpart and is left alone.
 *
 * Pass the value of the app's own `useWallet()`:
 * `useSolanaWalletAdapterSync(useWallet())`.
 */
export function useSolanaWalletAdapterSync(adapter: SolanaWalletAdapter): void {
  const store = useKitStore()
  const connection = useStore(store, (s) => s.solana.connection)
  const kitName =
    connection && connection.source === 'standard'
      ? connection.wallet.name
      : null
  // The wallet this hook last pushed into the adapter: a disconnect is
  // mirrored only for that one, never for a wallet the app chose itself.
  const syncedName = useRef<string | null>(null)
  // The kit wallet a connect was already attempted for. wallet-adapter flips
  // `connecting` back to false when the user refuses or the connect fails,
  // which re-runs this effect; without the latch that would reopen the
  // prompt for as long as the kit connection stands. One attempt per kit
  // connection; a new kit connection (another wallet, or a reconnect) gets
  // a fresh one.
  const attemptedFor = useRef<string | null>(null)

  const adapterName = adapter.wallet?.adapter.name ?? null
  const { connected, connecting, select, connect, disconnect } = adapter

  useEffect(() => {
    if (kitName) {
      if (!adapterName || !sameWalletName(adapterName, kitName)) {
        // wallet-adapter matches by the adapter's registered name, which for
        // Wallet Standard wallets is the name the wallet announces.
        select(kitName)
        return
      }
      if (!connected && !connecting && attemptedFor.current !== kitName) {
        attemptedFor.current = kitName
        syncedName.current = kitName
        connect().catch(() => {
          // The adapter prompts or refuses on its own terms; the kit's
          // connection stands either way, and the latch above keeps this
          // from asking again.
        })
      }
      return
    }
    attemptedFor.current = null
    if (
      syncedName.current &&
      adapterName &&
      sameWalletName(adapterName, syncedName.current) &&
      connected
    ) {
      syncedName.current = null
      disconnect().catch(() => {})
    }
  }, [kitName, adapterName, connected, connecting, select, connect, disconnect])
}
