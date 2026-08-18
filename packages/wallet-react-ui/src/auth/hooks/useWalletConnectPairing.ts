import { useEffect, useRef, useState } from 'react'
import {
  type Connector,
  useConnect,
  useConnections,
  useConnectors,
} from 'wagmi'
import { isMobile } from '../utils/isMobile'
import { isZeroDevWalletConnect } from '../utils/isZeroDevWalletConnect'
import { walletDeepLink } from '../utils/walletDeepLink'
import type { WalletGuideEntry } from '../walletGuide'
import { useAuth } from './useAuth'

export type WalletConnectPairing = {
  /** Pairing URI from the connector's `display_uri` event; null until it
   * arrives (or after a retry reset). */
  uri: string | null
  /** Epoch ms when `uri` stops being claimable (WC pairing TTL). */
  expiresAt: number | null
  error: string | null
  retry: () => void
  /** Wrapped deep link for the one-tap mobile redirect into `wallet`'s app,
   * or null when the tap should just open the sheet (desktop, claiming
   * installed connector, missing/stale URI). Checks freshness at call time. */
  deepLinkFor: (wallet: WalletGuideEntry) => string | null
}

/** WC v2 URIs carry `expiryTimestamp` (unix seconds); fall back to the
 * protocol's 5-minute pairing TTL when absent. */
function parseUriExpiry(uri: string): number {
  const match = /[?&]expiryTimestamp=(\d+)/.exec(uri)
  return match ? Number(match[1]) * 1000 : Date.now() + 5 * 60_000
}

/**
 * Runs one WalletConnect pairing for the lifetime of the mounting component —
 * mount kicks it, unmount abandons it.
 */
export function useWalletConnectPairing(): WalletConnectPairing {
  const { goToStep } = useAuth()
  const connectors = useConnectors()
  const wcConnector = connectors.find(isZeroDevWalletConnect)
  const { mutate: connect } = useConnect()
  // A restored WC session means the connector is already live — kicking
  // connect() on it would throw ConnectorAlreadyConnectedError.
  const connections = useConnections()
  const wcConnected = connections.some(
    (c) => c.connector.uid === wcConnector?.uid,
  )

  const [uri, setUri] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const startedRef = useRef(false)

  const startConnect = (target: Connector) => {
    setError(null)
    setUri(null)
    setExpiresAt(null)
    connect(
      { connector: target },
      {
        onSuccess: () => goToStep(null),
        onError: (err) => setError(err.message),
      },
    )
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only pairing setup — startConnect closes over kick-time callbacks (connect, goToStep), which must not retrigger the subscription
  useEffect(() => {
    if (!wcConnector || wcConnected) return
    const onMessage = ({ type, data }: { type: string; data?: unknown }) => {
      if (type === 'display_uri' && typeof data === 'string') {
        setUri(data)
        setExpiresAt(parseUriExpiry(data))
      }
    }
    // Subscribe before the connect kick — `display_uri` fires mid-connect.
    wcConnector.emitter.on('message', onMessage)
    if (!startedRef.current) {
      startedRef.current = true
      startConnect(wcConnector)
    }
    return () => wcConnector.emitter.off('message', onMessage)
  }, [wcConnector, wcConnected])

  return {
    uri,
    expiresAt,
    error,
    retry: () => {
      if (wcConnector) startConnect(wcConnector)
    },
    deepLinkFor: (wallet) =>
      walletDeepLink({
        wallet,
        connectors,
        uri,
        expiresAt,
        mobile: isMobile(),
      }),
  }
}
