import { type Config, connect } from '@wagmi/core'
import { Button, PoweredBy } from '@zerodev/react-ui'
import { useEffect, useRef } from 'react'
import { useConfig, useConnectors } from 'wagmi'
import { StatusScreen } from '../../shared/components/StatusScreen'
import type { ConnectFailure } from '../authStoreSlice'
import { useAuth } from '../hooks/useAuth'
import { isCancellationError } from '../utils/isCancellationError'
import { isRequestPendingError } from '../utils/isRequestPendingError'

/** One in-flight connect: its wagmi-store watcher, and its identity. */
type Attempt = {
  stopWatching: () => void
  /** wagmi connector uid this attempt is asking. */
  connectorUid: string
  /** The wallet answered (either way) — its request is no longer open. */
  settled: boolean
}

/**
 * The current attempt per wagmi config. Held outside React on purpose: it has
 * to outlive the component (see `attempt`), and a new attempt on the same
 * config replaces rather than stacks. Keyed by config, not a single module
 * variable, so two WagmiProvider trees on one page each keep their own —
 * otherwise the second tree's attempt would tear down the first tree's, and a
 * late approval there would leave its pending state set and re-prompt the
 * wallet on the next mount.
 *
 * The record doubles as the attempt's identity: a connect() promise can't be
 * cancelled, so a wallet the user walked away from can still reject later.
 * Only the attempt that is still current may report a failure.
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
    // Not a failure: the first request is still open inside the wallet, which
    // won't show a second prompt until it's answered — the user has to go to
    // the extension. Rendered as a waiting state, not an error.
    return {
      title: `Request waiting in ${walletName}`,
      message:
        `${walletName} still has your connection request open. ` +
        `Open ${walletName} from your browser's toolbar to approve or dismiss ` +
        'it, then try again.',
      pending: true,
    }
  }
  // Never render "[object Object]": wallets throw plain JSON-RPC error
  // objects, viem throws Errors with a friendlier `shortMessage`. A string
  // thrown as-is is shown as-is. Anything else — an object with no usable
  // message, such as `{ code: -32603 }` — gets a fixed sentence, with the
  // numeric code appended since it is the only actionable detail there.
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
    goBack,
  } = useAuth()
  const connectors = useConnectors()
  const config = useConfig()

  const connector = pendingWallet
    ? connectors.find((c) => c.uid === pendingWallet.connectorUid)
    : undefined
  const walletName = pendingWallet?.name ?? 'your wallet'

  const attempt = () => {
    // Single-flight per wallet: if this wallet's request is still open (the
    // user cancelled and picked it again), do NOT send another connect() —
    // wallets queue connection requests, approving one leaves the rest
    // queued, and the leftovers resurface later (e.g. right after logout).
    // Re-adopt the open attempt instead: its promise and watcher are alive
    // and will close the flow or surface the error here.
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

    // Starting an attempt ends the previous one on this config, whatever
    // happens next — including the early return below. Otherwise a wallet the
    // user left pending would stay current, and its late rejection would
    // overwrite the "no longer available" screen shown for the new one.
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

    // Close the flow the moment wagmi reports THIS connector connected —
    // watching wagmi's store directly, not through React. Hosts typically
    // redirect as soon as `isConnected` flips and unmount the widget in that
    // same render, which drops the mutation's onSuccess below and any effect
    // in this tree. Without a signal that survives unmount, the store was
    // left at `wallet-connecting`, and the next time the widget mounted
    // (e.g. after logout) this page re-ran connect() and re-prompted the
    // wallet. Deliberately kept alive after the user leaves this screen, so a
    // late approval still closes the widget; released on success, rejection,
    // or the next attempt.
    const unsubscribe = config.subscribe(
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
    )
    const thisAttempt: Attempt = {
      stopWatching: unsubscribe,
      connectorUid: connector.uid,
      settled: false,
    }
    const isCurrent = () => current.get(config) === thisAttempt
    const release = () => {
      unsubscribe()
      if (isCurrent()) current.delete(config)
    }
    current.set(config, thisAttempt)

    // The @wagmi/core action, not useConnect's mutate: React Query drops
    // per-call callbacks when the issuing observer remounts — Strict Mode's
    // simulated remount does exactly that, and the mount guard below stops
    // the re-kick — which left a rejection spinning on this screen forever.
    // A plain promise cannot lose its handlers, and the kit store is safe to
    // write to even after this page unmounts.
    connect(config, { connector }).then(
      () => {
        thisAttempt.settled = true
        release()
        clearPendingWallet()
        goToStep(null)
      },
      (err) => {
        thisAttempt.settled = true
        // A superseded attempt stays silent. The user left wallet A pending,
        // chose another method and started wallet B; A's promise outlived
        // that, and its late rejection would otherwise overwrite B's waiting
        // screen with an error about A. (A late *approval* is not gated: wagmi
        // is then connected, so closing the widget is the right outcome.)
        if (!isCurrent()) return
        release()
        setConnectError(describeConnectError(err, walletName))
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

  // Pop back to sign-up rather than pushing it: every way onto this page is
  // a wallet button on sign-up, so `sign-up` is what's under us in the
  // history. A push would leave `wallet-connecting` in the history, giving
  // sign-up a back arrow that remounts this page and calls connect() again
  // while the original wallet request is still open (-32002). The fallback
  // is defensive only — the history is never empty here in practice.
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
            {/* Leaves this screen only — a pending wallet request can't be
                cancelled from the page (EIP-1193 has no cancel), so the label
                says what it does rather than promising to close the wallet. */}
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
