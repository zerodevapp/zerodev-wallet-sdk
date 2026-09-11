import { type Config, connect } from '@wagmi/core'
import { Button, PoweredBy } from '@zerodev/react-ui'
import { useEffect, useRef } from 'react'
import { useConfig, useConnectors } from 'wagmi'
import { StatusScreen } from '../../shared/components/StatusScreen'
import { useAuth } from '../hooks/useAuth'

/** The in-flight connect() for a wagmi config. */
type Attempt = {
  connectorUid: string
  /** The wallet answered; its request is no longer open. */
  settled: boolean
}

/**
 * Current attempt per wagmi config. Lives outside React because the request
 * outlives this component: the user can leave the screen and come back while
 * the wallet still has it open.
 */
const current = new WeakMap<Config, Attempt>()

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
  const { pendingWallet, clearPendingWallet, goToStep, goBack } = useAuth()
  const connectors = useConnectors()
  const config = useConfig()

  const connector = pendingWallet
    ? connectors.find((c) => c.uid === pendingWallet.connectorUid)
    : undefined
  const walletName = pendingWallet?.name ?? 'your wallet'

  // Pop, don't push: pushing would leave `wallet-connecting` in the history,
  // and sign-up's back arrow would remount this page and connect() again.
  const leave = goBack ?? (() => goToStep('sign-up'))

  const close = () => {
    clearPendingWallet()
    goToStep(null)
  }

  const attempt = () => {
    // Single-flight per wallet: the user can leave this screen and pick the
    // same wallet again while its request is still open in the extension.
    // Wallets reject a second request instead of re-prompting, so re-adopt
    // the open one — its promise is alive and still drives this screen.
    const existing = connector ? current.get(config) : undefined
    if (
      connector &&
      existing &&
      !existing.settled &&
      existing.connectorUid === connector.uid
    ) {
      return
    }

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
    const thisAttempt: Attempt = { connectorUid: connector.uid, settled: false }
    current.set(config, thisAttempt)
    connect(config, { connector }).then(
      () => {
        thisAttempt.settled = true
        close()
      },
      () => {
        thisAttempt.settled = true
        // Silent return to sign-up, as before this screen existed. The failure
        // message is added in the next change.
        clearPendingWallet()
        leave()
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
        <StatusScreen imageName="loading" title={`Waiting for ${walletName}`}>
          Approve or reject the request in your wallet.
          <br />
          Nothing showing? Open the wallet, the request may be waiting behind
          its unlock screen.
        </StatusScreen>
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
