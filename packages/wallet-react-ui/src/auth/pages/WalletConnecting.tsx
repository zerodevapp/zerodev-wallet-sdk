import { type Config, connect } from '@wagmi/core'
import { Button, PoweredBy } from '@zerodev/react-ui'
import { useEffect, useRef } from 'react'
import { useConfig, useConnectors } from 'wagmi'
import { StatusScreen } from '../../shared/components/StatusScreen'
import { useKitStore } from '../../shared/hooks/useKitStore'
import type { ConnectFailure } from '../authStoreSlice'
import { useAuth } from '../hooks/useAuth'
import { isCancellationError } from '../utils/isCancellationError'
import { isRequestPendingError } from '../utils/isRequestPendingError'

/**
 * Connector uids with a connect() still open, per wagmi config. Outside React
 * because the request outlives this component, and keyed by connector because
 * several wallets can be left unanswered at once.
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

function describeConnectError(
  err: unknown,
  walletName: string,
): ConnectFailure {
  if (isCancellationError(err)) {
    return {
      title: 'Request declined',
      message: `You declined the connection request in ${walletName}.`,
      pending: false,
    }
  }
  if (isRequestPendingError(err)) {
    // Nothing failed: the wallet still has the first request open and will
    // not prompt again until it is answered there.
    return {
      title: `Request waiting in ${walletName}`,
      message:
        `${walletName} still has your connection request open. ` +
        `Open ${walletName} from your browser's toolbar to approve or ` +
        'dismiss it, then try again.',
      pending: true,
    }
  }
  // Wallets throw raw JSON-RPC objects, viem throws Errors with
  // `shortMessage`. Never render "[object Object]": fall back to a fixed
  // sentence plus the code, the only actionable detail such an object has.
  let message: string | undefined
  let code: number | undefined
  if (typeof err === 'string' && err.length > 0) {
    message = err
  } else if (typeof err === 'object' && err !== null) {
    const e = err as {
      shortMessage?: unknown
      message?: unknown
      code?: unknown
    }
    const text = e.shortMessage ?? e.message
    if (typeof text === 'string' && text.length > 0) message = text
    if (typeof e.code === 'number') code = e.code
  }
  return {
    title: 'Couldn’t connect',
    message:
      message ??
      `Something went wrong while connecting to ${walletName}. Please try again.` +
        (code !== undefined ? ` (code ${code})` : ''),
    pending: false,
  }
}

/**
 * The `wallet-connecting` step: shown from picking an external wallet until it
 * answers, which a locked or dismissed wallet never does — so leaving must
 * always be possible.
 *
 * This page owns the connect() call, since React Query drops per-call
 * callbacks when the sign-up page unmounts on the step change. The wallet
 * button only records intent (`startWalletConnect`).
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
  // Read outside React: the wallet can answer long after this unmounts.
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
    // Starting an attempt means waiting again: drop the previous outcome so
    // Try again shows the wallet rather than the failure it replaces.
    setConnectError(null)

    // Single-flight per wallet: a wallet rejects a second request rather than
    // re-prompting, so re-adopt the open one — its promise still drives this
    // screen.
    if (connector && openFor(config).has(connector.uid)) return

    // Gone, or already connected: connect() would throw rather than prompt,
    // so there is nothing to wait for.
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

    // @wagmi/core's connect(), not useConnect's mutate: a promise keeps its
    // handlers across remounts (Strict Mode) and after unmount, so a wallet
    // answered once the user left still closes the widget.
    const open = openFor(config)
    open.add(connector.uid)
    connect(config, { connector }).then(
      () => {
        open.delete(connector.uid)
        close()
      },
      (err: unknown) => {
        open.delete(connector.uid)
        // The abandoned prompt is often dismissed much later, by which point
        // the user has moved on. Act only while the flow is still waiting on
        // THIS wallet. (Approval is not gated: the wallet is then connected,
        // so ending the flow is right wherever they are.)
        const auth = store.getState().auth
        if (
          auth.step !== 'wallet-connecting' ||
          auth.pendingWallet?.connectorUid !== connector.uid
        ) {
          return
        }
        setConnectError(describeConnectError(err, walletName))
      },
    )
  }

  // wagmi can connect without our connect() promise resolving: after a reload
  // the wallet's queued request belongs to a dead page, and approving it
  // authorises the site through the connector's own events. Watch the store so
  // the flow still closes.
  useEffect(() => {
    if (!connector) return
    const uid = connector.uid
    return config.subscribe(
      (state) => (state.status === 'connected' ? state.current : null),
      (currentUid) => {
        if (!currentUid) return
        const connected = config.state.connections.get(currentUid)?.connector
        if (connected?.uid !== uid) return
        const auth = store.getState().auth
        auth.clearPendingWallet()
        auth.goToStep(null)
      },
    )
  }, [connector, config, store])

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
          <StatusScreen
            imageName={connectError.pending ? 'loading' : 'error'}
            title={connectError.title}
          >
            {connectError.message}
          </StatusScreen>
        )}
        {/* EIP-1193 has no cancel, so the label promises only what it does. */}
        <div className="zd:flex zd:flex-col zd:gap-1">
          {connectError !== null && (
            <Button action="primary" text="Try again" onClick={attempt} />
          )}
          <Button
            action="secondary"
            text="Choose another sign-in method"
            onClick={leave}
          />
        </div>
      </div>

      <PoweredBy className="zd:self-center zd:pt-4 zd:pb-6" />
    </>
  )
}
