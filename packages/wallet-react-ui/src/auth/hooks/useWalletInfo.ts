import { useEffect, useMemo, useState } from 'react'
import { useAccount } from 'wagmi'
import {
  matchesWallet,
  WALLET_GUIDE,
  type WalletGuideEntry,
  type WalletId,
} from '../walletGuide'

/** How the active connection reaches the wallet. */
export type WalletSource = 'injected' | 'walletconnect' | 'embedded' | 'other'

export type WalletInfo = {
  /** Human-readable wallet name ('MetaMask', 'Trust Wallet', …). */
  name?: string | undefined
  /** Wallet icon URL or data: URI, when one is known. */
  icon?: string | undefined
  /** Guide id when the wallet matches the kit's wallet guide. */
  walletId?: WalletId | undefined
  source: WalletSource
}

/** The slice of `@walletconnect/ethereum-provider` this hook reads. */
type WcPeerProvider = {
  session?: {
    peer?: {
      metadata?: { name?: string; icons?: readonly string[] }
    }
  }
}

/**
 * Guide entry for a WalletConnect peer, matched by name. Peers report their
 * own branding ('MetaMask Wallet', 'Trust Wallet', …), so match by
 * case-insensitive containment in either direction against the guide names.
 */
function guideEntryForPeerName(name: string): WalletGuideEntry | undefined {
  const peer = name.toLowerCase()
  return WALLET_GUIDE.find((wallet) => {
    const guide = wallet.name.toLowerCase()
    return peer.includes(guide) || guide.includes(peer)
  })
}

function guideEntryForConnector(connector: {
  id: string
  name?: string
  type?: string
  rdns?: string | readonly string[] | undefined
}): WalletGuideEntry | undefined {
  return WALLET_GUIDE.find((wallet) => matchesWallet(connector, wallet))
}

function useResolvedWalletInfo(): WalletInfo | undefined {
  const { connector, isConnected } = useAccount()
  const [peerMetadata, setPeerMetadata] = useState<
    { name?: string; icons?: readonly string[] } | undefined
  >(undefined)

  const isWalletConnect = !!connector && connector.type === 'walletConnect'

  useEffect(() => {
    if (!connector || !isWalletConnect) {
      setPeerMetadata(undefined)
      return
    }
    let cancelled = false
    connector
      .getProvider()
      .then((provider) => {
        if (cancelled) return
        const metadata = (provider as WcPeerProvider).session?.peer?.metadata
        setPeerMetadata(metadata)
      })
      .catch(() => {
        // Provider unavailable (torn down mid-flight) — stay unresolved.
      })
    return () => {
      cancelled = true
    }
  }, [connector, isWalletConnect])

  // Memoized so the identity is reference-stable across renders: consumers
  // put `walletInfo` in effect deps (analytics on wallet change), and a fresh
  // object every render would fire those on every render instead.
  return useMemo((): WalletInfo | undefined => {
    if (!isConnected || !connector) return undefined

    if (connector.id === 'zerodev-wallet') {
      return {
        name: connector.name,
        icon: connector.icon,
        source: 'embedded',
      }
    }

    if (isWalletConnect) {
      const entry = peerMetadata?.name
        ? guideEntryForPeerName(peerMetadata.name)
        : undefined
      return {
        name: peerMetadata?.name ?? undefined,
        icon: peerMetadata?.icons?.[0] ?? entry?.icon,
        walletId: entry?.id as WalletId | undefined,
        // Identity is about the session, so a raw walletConnect() connector
        // resolves here too — unlike pairing, which is kit-connector-only.
        source: 'walletconnect',
      }
    }

    const entry = guideEntryForConnector(connector)

    return {
      name: connector.name,
      icon: connector.icon ?? entry?.icon,
      walletId: entry?.id as WalletId | undefined,
      source: connector.type === 'injected' ? 'injected' : 'other',
    }
  }, [connector, isConnected, isWalletConnect, peerMetadata])
}

/**
 * Identity of the wallet behind the active wagmi connection, for
 * wallet-specific handling and analytics attribution. Call-compatible with
 * AppKit's `useWalletInfo` — same name, same `{ walletInfo }` return shape,
 * so migrating is an import swap; `walletId` and `source` are kit extras.
 *
 * wagmi's `useAccount().connector` already names injected wallets, but a
 * WalletConnect connection only reports "WalletConnect" — the actual wallet
 * on the other end (Trust, Rainbow, … on a phone) is in the session's peer
 * metadata, which this hook reads from the provider. `walletInfo` is
 * `undefined` while disconnected, and the WalletConnect case resolves
 * asynchronously (briefly `name: undefined` after connect/reload).
 *
 * @param _namespace - Accepted for AppKit call-compatibility ('eip155');
 * ignored — the kit is EVM-only.
 */
export function useWalletInfo(_namespace?: string): {
  walletInfo: WalletInfo | undefined
} {
  const walletInfo = useResolvedWalletInfo()
  // The wrapper is memoized too, so the returned object is stable for
  // consumers that depend on it whole rather than destructuring.
  return useMemo(() => ({ walletInfo }), [walletInfo])
}
