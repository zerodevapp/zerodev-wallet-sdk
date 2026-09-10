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

/** One in-flight connect() and its wagmi-store watchers. */
type Attempt = {
  stopWatching: () => void
  connectorUid: string
  /** The wallet answered; its request is no longer open. */
  settled: boolean
  /** connect() is held until wagmi's page-load reconnect settles. */
  awaitingReconnect: boolean
}

/**
 * Current attempt per wagmi config. Lives outside React because it must
 * outlive this component; keyed by config so two WagmiProvider trees don't
 * cancel each other. The record is also the attempt's identity: a connect()
 * promise can't be cancelled, so only the current attempt may report failure.
 */
const current = new WeakMap<Config, Attempt>()

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
    // Not a failure: the wallet still has the first request open and won't
    // prompt again until it's answered there.
    return {
      title: `Request waiting in ${walletName}`,
      message:
        `${walletName} still has your connection request open. ` +
        `Open ${walletName} from your browser's toolbar to approve or dismiss ` +
        'it, then try again.',
      pending: true,
    }
  }
  // Wallets throw raw JSON-RPC objects, viem throws Errors with `shortMessage`.
  // Never render "[object Object]": fall back to a fixed sentence plus the code.
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
 * answers. A locked wallet, or a popup the user closed, never answers, so the
 * user must always be able to leave or retry.
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
    goBack,
  } = useAuth()
  const connectors = useConnectors()
  const config = useConfig()
  const store = useKitStore()

  const connector = pendingWallet
    ? connectors.find((c) => c.uid === pendingWallet.connectorUid)
    : undefined
  const walletName = pendingWallet?.name ?? 'your wallet'

  const attempt = () => {
    // Single-flight per wallet: if its request is still open, re-adopt the
    // attempt instead of sending another connect() — wallets queue requests,
    // and the leftovers resurface later as ghost prompts.
    const existing = current.get(config)
    if (
      connector &&
      existing &&
      !existing.settled &&
      existing.connectorUid === connector.uid
    ) {
      setConnectError(null)
      return
    }

    // A new attempt ends the previous one, even on the early return below;
    // otherwise its late rejection could overwrite this one's error.
    existing?.stopWatching()
    current.delete(config)

    if (!connector) {
      setConnectError({
        title: 'Couldn’t connect',
        message:
          'This wallet is no longer available. Choose another sign-in method.',
        pending: false,
      })
      return
    }
    setConnectError(null)

    const stops: Array<() => void> = []
    const thisAttempt: Attempt = {
      stopWatching: () => {
        for (const stop of stops) stop()
      },
      connectorUid: connector.uid,
      settled: false,
      awaitingReconnect: false,
    }
    const isCurrent = () => current.get(config) === thisAttempt
    const release = () => {
      thisAttempt.stopWatching()
      if (isCurrent()) current.delete(config)
    }
    current.set(config, thisAttempt)

    // Close the flow when wagmi reports THIS connector connected, via the
    // store rather than React: hosts redirect on `isConnected` and unmount the
    // widget in the same render, dropping React-side callbacks. Kept alive
    // after the user leaves this screen so a late approval still closes the
    // widget; released on success, rejection, or the next attempt.
    stops.push(
      config.subscribe(
        (state) => (state.status === 'connected' ? state.current : null),
        (current) => {
          if (!current) return
          const connected = config.state.connections.get(current)?.connector
          if (connected?.uid !== connector.uid) return
          thisAttempt.settled = true
          release()
          clearPendingWallet()
          goToStep(null)
        },
      ),
    )

    const proceed = () => {
      thisAttempt.awaitingReconnect = false

      // Already connected (wagmi restored a session, or the sweep just did):
      // connect() would throw ConnectorAlreadyConnectedError, so close as a
      // success. Only trustworthy after 'reconnecting' — see below.
      const alreadyConnected = [...config.state.connections.values()].some(
        (connection) => connection.connector.uid === connector.uid,
      )
      if (alreadyConnected) {
        thisAttempt.settled = true
        release()
        clearPendingWallet()
        goToStep(null)
        return
      }

      // @wagmi/core's connect(), not useConnect's mutate: a promise can't lose
      // its handlers on remount (Strict Mode), and the kit store is safe to
      // write after unmount.
      connect(config, { connector }).then(
        () => {
          thisAttempt.settled = true
          release()
          clearPendingWallet()
          goToStep(null)
        },
        (err) => {
          thisAttempt.settled = true
          // Only the current attempt reports failure: a wallet the user
          // walked away from may reject after another one was picked.
          // (A late approval is not gated — wagmi is then connected.)
          if (!isCurrent()) return
          release()
          setConnectError(describeConnectError(err, walletName))
        },
      )
    }

    if (config.state.status !== 'reconnecting') {
      proceed()
      return
    }

    // Page-load reconnect still sweeping: the store holds unverified sessions
    // hydrated from storage, and wagmi may call this connector's connect()
    // itself (a second request would race it). Hold until it settles; if the
    // sweep reconnects this connector, the watcher above closes the flow.
    thisAttempt.awaitingReconnect = true
    const stopWaiting = config.subscribe(
      (state) => state.status,
      (status) => {
        if (status === 'reconnecting') return
        stopWaiting()
        if (!isCurrent()) return
        // The user may have left meanwhile via back/close, which bypass this
        // page — so check the kit store. Nothing reached the wallet yet, so
        // drop the attempt rather than prompt after they've gone.
        const { step, pendingWallet: wanted } = store.getState().auth
        if (
          step !== 'wallet-connecting' ||
          wanted?.connectorUid !== connector.uid
        ) {
          release()
          if (wanted?.connectorUid === connector.uid) clearPendingWallet()
          return
        }
        proceed()
      },
    )
    stops.push(stopWaiting)
  }

  // Once on mount; the ref guards Strict Mode's double effect run.
  const started = useRef(false)
  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only kick; `attempt` is intentionally the mount-time closure
  useEffect(() => {
    if (started.current) return
    started.current = true
    attempt()
  }, [])

  // Pop, don't push: pushing would leave `wallet-connecting` in the history,
  // and sign-up's back arrow would remount this page and connect() again.
  const chooseAnother = goBack ?? (() => goToStep('sign-up'))

  return (
    <>
      <div className="zd:flex-1 zd:flex zd:flex-col zd:gap-8 zd:items-center zd:justify-center">
        {connectError === null ? (
          <>
            <StatusScreen
              imageName="loading"
              title={`Waiting for ${walletName}`}
            >
              Approve or reject the request in your wallet.
              <br />
              Nothing showing? Open the wallet, the request may be waiting
              behind its unlock screen.
            </StatusScreen>
            {/* A pending wallet request can't be cancelled (EIP-1193), so the
                label promises only what it does. */}
            <Button
              action="secondary"
              text="Choose another sign-in method"
              onClick={chooseAnother}
            />
          </>
        ) : (
          <>
            <StatusScreen
              imageName={connectError.pending ? 'loading' : 'error'}
              title={connectError.title}
            >
              {connectError.message}
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
