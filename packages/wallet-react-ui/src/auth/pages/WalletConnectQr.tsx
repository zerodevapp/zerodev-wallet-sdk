import { Button, Text } from '@zerodev/react-ui'
import { useEffect, useRef, useState } from 'react'
import { type Connector, useConfig, useConnect } from 'wagmi'
import { useStore } from 'zustand'
import { PoweredBy } from '../../shared/components/PoweredBy'
import { useKitStore } from '../../shared/hooks/useKitStore'
import { QrCode } from '../components/QrCode'
import { useAuth } from '../hooks/useAuth'

export function WalletConnectQr() {
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
  const [copied, setCopied] = useState(false)

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

  const copyUri = async () => {
    if (!uri) return
    await navigator.clipboard.writeText(uri)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!walletConnectProjectId && !connector) {
    return (
      <div className="zd:flex-1 zd:flex zd:items-center zd:justify-center">
        <Text className="zd:text-center">
          WalletConnect is not configured. Pass `walletConnectProjectId` to the
          zeroDevWallet connector config.
        </Text>
      </div>
    )
  }

  return (
    <>
      <div className="zd:flex-1 zd:flex zd:flex-col zd:gap-4 zd:items-center zd:justify-center">
        <Text className="zd:text-h2 zd:text-center">Scan with your wallet</Text>

        {error ? (
          <div className="zd:flex zd:flex-col zd:gap-3 zd:items-center">
            <Text className="zd:text-center zd:text-red-500">{error}</Text>
            <Button
              action="secondary"
              text="Try again"
              onClick={() => connector && startConnect(connector)}
            />
          </div>
        ) : uri ? (
          <>
            <div className="zd:bg-white zd:rounded-3xl zd:p-4 zd:text-black">
              <QrCode value={uri} className="zd:w-56 zd:h-56" />
            </div>
            <Button
              action="secondary"
              text={copied ? 'Copied' : 'Copy link'}
              onClick={copyUri}
            />
          </>
        ) : (
          <Text className="zd:text-center zd:text-greyScale/50">
            Generating connection link…
          </Text>
        )}
      </div>

      <PoweredBy className="zd:self-center zd:pt-4 zd:pb-6" />
    </>
  )
}
