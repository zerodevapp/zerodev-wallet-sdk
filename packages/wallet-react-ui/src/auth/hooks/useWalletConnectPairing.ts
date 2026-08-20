import { useEffect, useRef, useState } from 'react'
import {
  type Connector,
  useConnect,
  useConnections,
  useConnectors,
} from 'wagmi'
import { useAuth } from './useAuth'

export type WalletConnectPairing = {
  /** Pairing URI from the connector's `display_uri` event; null until it
   * arrives (or after a retry reset). */
  uri: string | null
  error: string | null
  retry: () => void
}

/**
 * Runs one WalletConnect pairing for the lifetime of the mounting component —
 * mount kicks it, unmount abandons it.
 */
export function useWalletConnectPairing(): WalletConnectPairing {
  const { goToStep } = useAuth()
  const connectors = useConnectors()
  const wcConnector = connectors.find(
    (c) => c.type === 'walletConnect' && 'zdWalletConnect' in c,
  )
  const { mutate: connect } = useConnect()
  // A restored WC session means the connector is already live — kicking
  // connect() on it would throw ConnectorAlreadyConnectedError.
  const connections = useConnections()
  const wcConnected = connections.some(
    (c) => c.connector.uid === wcConnector?.uid,
  )

  const [uri, setUri] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const startedRef = useRef(false)

  const startConnect = (target: Connector) => {
    setError(null)
    setUri(null)
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
      if (type === 'display_uri' && typeof data === 'string') setUri(data)
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
    error,
    retry: () => {
      if (wcConnector) startConnect(wcConnector)
    },
  }
}
