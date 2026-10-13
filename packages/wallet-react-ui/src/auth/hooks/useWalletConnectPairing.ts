import { useEffect, useRef, useState } from 'react'
import {
  type Connector,
  useAccount,
  useConnect,
  useConnections,
  useConnectors,
} from 'wagmi'
import { isMobile } from '../utils/isMobile'
import { isZeroDevWalletConnect } from '../utils/isZeroDevWalletConnect'
import { walletDeepLink } from '../utils/walletDeepLink'
import type { WalletGuideEntry } from '../walletGuide'
import { useAuth } from './useAuth'

type WcExpiryEvents = {
  on: (event: 'proposal_expire', listener: () => void) => unknown
  off: (event: 'proposal_expire', listener: () => void) => unknown
}
/** The slice of `@walletconnect/ethereum-provider` this hook touches: the
 * provider emits `connect` only when a session settles fresh (a pairing the
 * user just approved) — never for a session restored from storage — and the
 * sign-client's emitter fires `proposal_expire` when the pairing offer's TTL
 * runs out. */
type WcPairingProvider = {
  on: (event: 'connect', listener: () => void) => unknown
  off: (event: 'connect', listener: () => void) => unknown
  signer?: { client?: { events?: WcExpiryEvents } }
}

export type WalletConnectPairing = {
  /** Pairing URI from the connector's `display_uri` event; null until it
   * arrives (or after a retry reset). */
  uri: string | null
  error: string | null
  retry: () => void
  /** Wrapped deep link for the one-tap mobile redirect into `wallet`'s app,
   * or null when the tap should just open the sheet (desktop, claiming
   * installed connector, no usable URI). An errored pairing — including
   * WalletConnect's own proposal expiry — never redirects. */
  deepLinkFor: (wallet: WalletGuideEntry) => string | null
}

/**
 * Runs one WalletConnect pairing for the lifetime of the mounting component —
 * mount kicks it, unmount abandons it.
 */
export function useWalletConnectPairing(): WalletConnectPairing {
  const { goToStep } = useAuth()
  const connectors = useConnectors()
  const wcConnector = connectors.find(isZeroDevWalletConnect)
  const { connect } = useConnect()
  // A restored WC session means the connector is already live — kicking
  // connect() on it would throw ConnectorAlreadyConnectedError.
  const connections = useConnections()
  const wcConnected = connections.some(
    (c) => c.connector.uid === wcConnector?.uid,
  )
  // While wagmi is still rehydrating persisted sessions, hold the pairing
  // kick — a connector mid-restore may be about to come back as connected.
  const { isReconnecting } = useAccount()

  const [uri, setUri] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const startedRef = useRef(false)

  const startConnect = (target: Connector) => {
    setError(null)
    setUri(null)
    connect({ connector: target }, { onError: (err) => setError(err.message) })
  }
  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only pairing setup — startConnect closes over kick-time callbacks (connect, goToStep), which must not retrigger the subscription
  useEffect(() => {
    if (!wcConnector || wcConnected) return
    const onMessage = ({ type, data }: { type: string; data?: unknown }) => {
      if (type === 'display_uri' && typeof data === 'string') setUri(data)
    }
    // Subscribe before the connect kick — `display_uri` fires mid-connect.
    wcConnector.emitter.on('message', onMessage)

    // Expiry comes from the sign-client's own event, not the connect
    // mutation — this subscription is re-established every effect run, so it
    // survives Strict Mode where the mutation's `onError` does not.
    const onExpire = () => setError('Proposal expired')
    // Success is the provider's `connect` event — emitted only when a session
    // settles fresh (the user approved a pairing), never when wagmi restores
    // a persisted session, so rehydration can't close a flow the user is
    // looking at. Whether an already-connected user should see sign-up at
    // all stays the host's `isConnected` decision.
    const onConnect = () => goToStep(null)

    let wcProvider: WcPairingProvider | undefined
    let disposed = false

    wcConnector
      .getProvider()
      .then((provider) => {
        if (disposed) return
        wcProvider = provider as WcPairingProvider
        wcProvider.signer?.client?.events?.on('proposal_expire', onExpire)
        wcProvider.on('connect', onConnect)
      })
      .catch((err) => {
        // Provider init failed — surface through the pairing's error state
        // instead of an unhandled rejection.
        if (!disposed)
          setError(err instanceof Error ? err.message : String(err))
      })
    if (!startedRef.current && !isReconnecting) {
      startedRef.current = true
      startConnect(wcConnector)
    }
    return () => {
      disposed = true
      wcProvider?.signer?.client?.events?.off('proposal_expire', onExpire)
      wcProvider?.off('connect', onConnect)
      wcConnector.emitter.off('message', onMessage)
    }
  }, [wcConnector, wcConnected, isReconnecting])

  return {
    uri,
    error,
    retry: () => {
      if (wcConnector) startConnect(wcConnector)
    },
    deepLinkFor: (wallet) =>
      walletDeepLink({
        wallet,
        connectors,
        uri: error ? null : uri,
        mobile: isMobile(),
      }),
  }
}
