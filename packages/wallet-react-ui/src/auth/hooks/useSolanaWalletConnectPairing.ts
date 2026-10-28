import { useEffect, useState } from 'react'
import { useKitStore } from '../../shared/hooks/useKitStore'
import { errorMessage } from '../../shared/utils/errorMessage'
import { useSolanaWalletConnect } from '../../solana/hooks/useSolanaWalletConnect'
import { providerOfSolanaWalletConnectWallet } from '../../solana/walletconnect/wallet'
import { isCancellationError } from '../utils/isCancellationError'
import { useAuth } from './useAuth'
import type { WalletConnectPairing } from './useWalletConnectPairing'

/**
 * One Solana-over-WalletConnect pairing while `active`: turning active
 * loads the provider and proposes the session (its `display_uri` feeds the
 * QR), turning inactive abandons the proposal. Keyed on a flag rather than
 * on mount so the sheet can stay mounted through its close animation. On
 * approval the session is in the kit's Solana slot and the sign-up flow
 * closes, as after an installed wallet connects. Same shape as the EVM
 * pairing so `WalletSheet` renders either; there are no wallet-specific
 * deep links yet, so `deepLinkFor` always opens the sheet.
 */
export function useSolanaWalletConnectPairing(
  active = true,
): WalletConnectPairing {
  const {
    wallet,
    error: loadError,
    retry: retryLoad,
  } = useSolanaWalletConnect(active)
  const store = useKitStore()
  const { goToStep } = useAuth()
  const [uri, setUri] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` is the retry trigger; store and goToStep are stable
  useEffect(() => {
    if (!active || !wallet) return
    const provider = providerOfSolanaWalletConnectWallet(wallet)
    if (!provider) return
    // This attempt's lifetime. Once it ends, nothing the wallet answers
    // later may touch the flow: not the store (the signal), not the auth
    // step, not this sheet's error (the `attemptActive` checks).
    const attemptController = new AbortController()
    let attemptActive = true
    let settled = false
    setUri(null)
    setError(null)
    const onUri = (next: unknown) => {
      if (typeof next === 'string') setUri(next)
    }
    provider.on('display_uri', onUri)
    store
      .getState()
      .solana.connect(wallet, { signal: attemptController.signal })
      .then(() => {
        settled = true
        if (attemptActive) goToStep(null)
      })
      .catch((err) => {
        settled = true
        if (!attemptActive) return
        // A decline on the phone kills the proposal, so the QR is dead: say
        // so and offer Try again, as the EVM sheet does for a rejection.
        setError(
          isCancellationError(err) ? 'Connection declined' : errorMessage(err),
        )
      })
    return () => {
      attemptActive = false
      provider.off('display_uri', onUri)
      if (settled) return
      // Leaving the sheet mid-pairing. The signal makes the store refuse a
      // late approval and end the session it made; expiring the pending
      // pairings kills the QR on the relay, so the phone's approval fails
      // instead of hanging. (`abortPairingAttempt` is a no-op in the SDK.)
      attemptController.abort()
      provider
        .cleanupPendingPairings?.({ deletePairings: true })
        .catch(() => {})
    }
  }, [active, wallet, attempt])

  return {
    uri,
    error: error ?? loadError,
    retry: () => {
      // A failed SDK load has no wallet to pair with: reload it first, and
      // the pairing effect follows once the wallet arrives.
      if (!wallet) retryLoad()
      else setAttempt((n) => n + 1)
    },
    deepLinkFor: () => null,
  }
}
