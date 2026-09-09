import { Button, PoweredBy } from '@zerodev/react-ui'
import { useEffect, useRef } from 'react'
import { useConnect, useConnectors } from 'wagmi'
import { StatusScreen } from '../../shared/components/StatusScreen'
import { useAuth } from '../hooks/useAuth'
import { isCancellationError } from '../utils/isCancellationError'
import { isRequestPendingError } from '../utils/isRequestPendingError'

function describeConnectError(err: unknown, walletName: string): string {
  if (isCancellationError(err)) {
    return `You declined the connection request in ${walletName}.`
  }
  if (isRequestPendingError(err)) {
    return (
      `${walletName} already has a connection request open. ` +
      'Approve or dismiss it in the wallet, then try again.'
    )
  }
  return err instanceof Error ? err.message : String(err)
}

/**
 * The `wallet-connecting` step: shown from the moment the user picks an
 * external wallet until it answers. Exists because a wallet that is locked,
 * or whose popup the user simply closed, never answers — and the previous
 * design (disable every button while wagmi's connect is pending) left the
 * page frozen with no error and no way out. Here the user can always cancel
 * or try again, whatever the wallet does.
 *
 * This page owns the `connect()` call. React Query drops per-call mutation
 * callbacks when the component that issued them unmounts, and the sign-up
 * page unmounts on the step change — so the button that started the flow
 * only records intent (`startWalletConnect`) and this page does the work.
 */
export function WalletConnecting() {
  const {
    pendingWallet,
    connectError,
    setConnectError,
    clearPendingWallet,
    goToStep,
  } = useAuth()
  const connectors = useConnectors()
  const { connect } = useConnect()

  const connector = pendingWallet
    ? connectors.find((c) => c.uid === pendingWallet.connectorUid)
    : undefined
  const walletName = pendingWallet?.name ?? 'your wallet'

  const attempt = () => {
    if (!connector) {
      setConnectError(
        'This wallet is no longer available. Choose another sign-in method.',
      )
      return
    }
    setConnectError(null)
    connect(
      { connector },
      {
        // The external wallet is now the active wagmi connection — the
        // embedded-wallet flow is done, so close the widget. Forget the
        // record too, or reopening the widget later while this wallet is
        // still connected would close it on sight (see ConnectWallet).
        onSuccess: () => {
          clearPendingWallet()
          goToStep(null)
        },
        onError: (err) =>
          setConnectError(describeConnectError(err, walletName)),
      },
    )
  }

  // Kick the request once on mount. The ref guards Strict Mode's double
  // effect run — a second connect() would trip the wallet's "request already
  // pending" error before the user has seen the first prompt.
  const started = useRef(false)
  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only kick; `attempt` is intentionally the mount-time closure
  useEffect(() => {
    if (started.current) return
    started.current = true
    attempt()
  }, [])

  const chooseAnother = () => goToStep('sign-up')

  return (
    <>
      <div className="zd:flex-1 zd:flex zd:flex-col zd:gap-8 zd:items-center zd:justify-center">
        {connectError === null ? (
          <>
            <StatusScreen
              imageName="loading"
              title={`Connecting to ${walletName}`}
            >
              Approve the connection request in your wallet.
              <br />
              Nothing showing? Open the wallet — the request may be waiting
              behind its unlock screen.
            </StatusScreen>
            <Button action="secondary" text="Cancel" onClick={chooseAnother} />
          </>
        ) : (
          <>
            <StatusScreen imageName="error" title="Couldn’t connect">
              {connectError}
            </StatusScreen>
            <div className="zd:flex zd:flex-col zd:gap-1">
              <Button action="primary" text="Try again" onClick={attempt} />
              <Button
                action="secondary"
                text="Choose another sign-in method"
                onClick={chooseAnother}
              />
            </div>
          </>
        )}
      </div>

      <PoweredBy className="zd:self-center zd:pt-4 zd:pb-6" />
    </>
  )
}
