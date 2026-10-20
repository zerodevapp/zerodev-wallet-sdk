import { useEffect, useState } from 'react'
import { useKitStore } from '../../shared/hooks/useKitStore'
import { errorMessage } from '../../shared/utils/errorMessage'
import { useSolanaWalletConnect } from '../../solana/hooks/useSolanaWalletConnect'
import { providerOfSolanaWalletConnectWallet } from '../../solana/walletconnect/wallet'
import { isCancellationError } from '../utils/isCancellationError'
import { useAuth } from './useAuth'
import type { WalletConnectPairing } from './useWalletConnectPairing'

/**
 * One Solana-over-WalletConnect pairing for the lifetime of the mounting
 * component: mount proposes the session (the provider's `display_uri` feeds
 * the QR), unmount abandons it. On approval the session is in the kit's
 * Solana slot and the sign-up flow closes, as after an installed wallet
 * connects. Same shape as the EVM pairing so `WalletSheet` renders either;
 * there are no wallet-specific deep links yet, so `deepLinkFor` always
 * opens the sheet.
 */
export function useSolanaWalletConnectPairing(): WalletConnectPairing {
  const {
    wallet,
    error: loadError,
    retry: retryLoad,
  } = useSolanaWalletConnect()
  const store = useKitStore()
  const { goToStep } = useAuth()
  const [uri, setUri] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` is the retry trigger; store and goToStep are stable
  useEffect(() => {
    if (!wallet) return
    const provider = providerOfSolanaWalletConnectWallet(wallet)
    if (!provider) return
    let settled = false
    setUri(null)
    setError(null)
    const onUri = (next: unknown) => {
      if (typeof next === 'string') setUri(next)
    }
    provider.on('display_uri', onUri)
    store
      .getState()
      .solana.connect(wallet)
      .then(() => {
        settled = true
        goToStep(null)
      })
      .catch((err) => {
        settled = true
        // A decline on the phone kills the proposal, so the QR is dead: say
        // so and offer Try again, as the EVM sheet does for a rejection.
        setError(
          isCancellationError(err) ? 'Connection declined' : errorMessage(err),
        )
      })
    return () => {
      provider.off('display_uri', onUri)
      // Leaving the sheet mid-pairing: drop the proposal so the relay is
      // not left waiting and a late approval cannot connect behind the
      // user's back. The store's connect rejects and settles its status.
      if (!settled) provider.abortPairingAttempt?.()
    }
  }, [wallet, attempt])

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
