import { useEffect, useRef, useState } from 'react'
import { type Connector, useConfig, useConnect } from 'wagmi'
import { useStore } from 'zustand'
import { useKitStore } from '../../shared/hooks/useKitStore'
import { useAuth } from './useAuth'

/**
 * Owns the WalletConnect pairing lifecycle for the wallet-selection screen:
 * finds (or creates from `walletConnectProjectId`) the wagmi walletConnect
 * connector, subscribes to its `display_uri` event, and starts the pairing so
 * the URI is ready before the user opens any wallet's connection sheet.
 *
 * No-ops (returns nulls) when WalletConnect isn't configured.
 */
export function useWalletConnectPairing() {
  const { goToStep } = useAuth()
  const config = useConfig()
  const walletConnectProjectId = useStore(
    useKitStore(),
    (s) => s.walletConnectProjectId,
  )
  const { connect } = useConnect()

  const [connector, setConnector] = useState<Connector | null>(null)
  const [uri, setUri] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Both refs survive Strict Mode's unmount/remount, so the connector is
  // created and the pairing kicked off exactly once.
  const ensureConnectorRef = useRef<Promise<Connector | null> | null>(null)
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

  useEffect(() => {
    let unsubscribe: (() => void) | undefined
    let cancelled = false

    ensureConnectorRef.current ??= (async () => {
      const existing = config.connectors.find((c) => c.type === 'walletConnect')
      if (existing) return existing
      if (!walletConnectProjectId) return null

      const { walletConnect } = await import('wagmi/connectors')
      // Same registration wagmi's own `connect()` performs for connector
      // factories — makes the connector visible to hooks and reconnects.
      const created = config._internal.connectors.setup(
        walletConnect({
          projectId: walletConnectProjectId,
          showQrModal: false,
        }),
      )
      config._internal.connectors.setState((prev) => [...prev, created])
      return created
    })()

    ensureConnectorRef.current.then((target) => {
      if (cancelled || !target) return
      setConnector(target)

      const onMessage = ({ type, data }: { type: string; data?: unknown }) => {
        if (type === 'display_uri' && typeof data === 'string') setUri(data)
      }
      target.emitter.on('message', onMessage)
      unsubscribe = () => target.emitter.off('message', onMessage)

      if (!startedRef.current) {
        startedRef.current = true
        startConnect(target)
      }
    })

    return () => {
      cancelled = true
      unsubscribe?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only pairing setup
  }, [])

  return {
    /** Configured at all? False → hide WalletConnect-dependent UI. */
    enabled: !!walletConnectProjectId || !!connector,
    uri,
    error,
    retry: () => connector && startConnect(connector),
  }
}
