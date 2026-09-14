import { type Config, connect } from '@wagmi/core'
import { Button, PoweredBy } from '@zerodev/react-ui'
import { useEffect, useRef } from 'react'
import { useConfig, useConnectors } from 'wagmi'
import { StatusScreen } from '../../shared/components/StatusScreen'
import { useKitStore } from '../../shared/hooks/useKitStore'
import { useAuth } from '../hooks/useAuth'
import { isCancellationError } from '../utils/isCancellationError'

/**
 * Connector uids with a connect() still open, per wagmi config. Lives outside
 * React because the request outlives this component: the user can leave the
 * screen and come back while the wallet still has it open. Keyed by connector
 * because several wallets can be left unanswered at once — leave MetaMask,
 * try Rabby, then come back to MetaMask.
 */
const openRequests = new WeakMap<Config, Set<string>>()

function openFor(config: Config): Set<string> {
  let uids = openRequests.get(config)
  if (!uids) {
    uids = new Set()
    openRequests.set(config, uids)
  }
  return uids
}

/**
 * The `wallet-connecting` step: shown from picking an external wallet until it
 * answers. A locked wallet, or a popup the user closed, never answers, so the
 * user must always be able to leave.
 *
 * This page owns the connect() call: React Query drops per-call callbacks when
 * the issuing component unmounts, and the sign-up page unmounts on the step
 * change. The wallet button only records intent (`startWalletConnect`).
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
  const config = useConfig()
  // Read outside React too: the wallet can answer long after this unmounts.
  const store = useKitStore()

  const connector = pendingWallet
    ? connectors.find((c) => c.uid === pendingWallet.connectorUid)
    : undefined
  const walletName = pendingWallet?.name ?? 'your wallet'

  // Pop, don't push: pushing would leave `wallet-connecting` in the history,
  // and sign-up's back arrow would remount this page and connect() again.
  const leave = () => {
    const auth = store.getState().auth
    if (auth.stepHistory.length > 0) auth.goBack()
    else auth.goToStep('sign-up')
  }

  const close = () => {
    clearPendingWallet()
    goToStep(null)
  }

  const attempt = () => {
    // Single-flight per wallet: the user can leave this screen and pick the
    // same wallet again while its request is still open in the extension.
    // Wallets reject a second request instead of re-prompting, so re-adopt
    // the open one — its promise is alive and still drives this screen.
    if (connector && openFor(config).has(connector.uid)) return

    // The wallet is gone, or already connected: wagmi's connect() would throw
    // rather than prompt, so there is nothing to wait for on this screen.
    if (!connector) {
      clearPendingWallet()
      leave()
      return
    }
    const alreadyConnected = [...config.state.connections.values()].some(
      (connection) => connection.connector.uid === connector.uid,
    )
    if (alreadyConnected) {
      close()
      return
    }

    // @wagmi/core's connect(), not useConnect's mutate: a promise can't lose
    // its handlers on remount (Strict Mode), and the kit store is safe to
    // write after unmount — so a wallet answered after the user left this
    // screen still closes the widget.
    const open = openFor(config)
    open.add(connector.uid)
    connect(config, { connector }).then(
      () => {
        open.delete(connector.uid)
        close()
      },
      (err: unknown) => {
        open.delete(connector.uid)
        // The user may have moved on while the wallet sat unanswered — email,
        // another wallet, or simply away — and the abandoned prompt is often
        // dismissed later. Only act while the flow is still waiting on THIS
        // wallet, or a late rejection would drag them out of what they are
        // doing. (A late *approval* is not gated: the wallet is then
        // connected, so ending the flow is right wherever they are.)
        const auth = store.getState().auth
        if (
          auth.step !== 'wallet-connecting' ||
          auth.pendingWallet?.connectorUid !== connector.uid
        ) {
          return
        }
        // A user rejection needs no explanation: back to the other sign-in
        // methods, as before this screen existed. Anything else is a real
        // failure, and its message is the only diagnostic the host gets.
        if (isCancellationError(err)) {
          clearPendingWallet()
          leave()
          return
        }
        setConnectError(err instanceof Error ? err.message : String(err))
      },
    )
  }

  // Once on mount; the ref guards Strict Mode's double effect run.
  const started = useRef(false)
  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only kick; `attempt` is intentionally the mount-time closure
  useEffect(() => {
    if (started.current) return
    started.current = true
    attempt()
  }, [])

  return (
    <>
      <div className="zd:flex-1 zd:flex zd:flex-col zd:gap-8 zd:items-center zd:justify-center">
        {connectError === null ? (
          <StatusScreen imageName="loading" title={`Waiting for ${walletName}`}>
            Approve or reject the request in your wallet.
            <br />
            Nothing showing? Open the wallet, the request may be waiting behind
            its unlock screen.
          </StatusScreen>
        ) : (
          <StatusScreen imageName="error" title="Couldn’t connect">
            {connectError}
          </StatusScreen>
        )}
        {/* A pending wallet request can't be cancelled (EIP-1193), so the
            label promises only what it does. */}
        <Button
          action="secondary"
          text="Choose another sign-in method"
          onClick={leave}
        />
      </div>

      <PoweredBy className="zd:self-center zd:pt-4 zd:pb-6" />
    </>
  )
}
