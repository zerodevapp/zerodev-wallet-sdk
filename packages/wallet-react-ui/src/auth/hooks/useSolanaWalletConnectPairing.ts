import { useEffect, useState } from 'react'
import { useKitStore } from '../../shared/hooks/useKitStore'
import { useSolanaWalletConnect } from '../../solana/hooks/useSolanaWalletConnect'
import { providerOfSolanaWalletConnectWallet } from '../../solana/walletconnect/wallet'
import { isCancellationError } from '../utils/isCancellationError'
import { useAuth } from './useAuth'
import type { WalletConnectPairing } from './useWalletConnectPairing'

/**
 * One Solana-over-WalletConnect pairing for the lifetime of the mounting
 * component: mount proposes the session (the provider's `display_uri` feeds
 * the QR), unmount abandons it. On approval the session is handed to the
 * kit's Solana slot and the sign-up flow closes, as after an installed
 * wallet connects. Same shape as the EVM pairing so `WalletSheet` renders
 * either; there are no wallet-specific deep links yet, so `deepLinkFor`
 * always opens the sheet.
 */
export function useSolanaWalletConnectPairing(): WalletConnectPairing {
  const { wallet, error: loadError } = useSolanaWalletConnect()
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
    // Pair through the wallet itself rather than the store's connect(), so
    // the slot does not read as "connecting" while a QR nobody may scan sits
    // on screen; the store takes the settled session in one silent step.
    wallet.features['standard:connect']
      .connect()
      .then(() => store.getState().solana.connect(wallet, { silent: true }))
      .then(() => {
        settled = true
        goToStep(null)
      })
      .catch((err) => {
        settled = true
        if (isCancellationError(err)) return
        setError(err instanceof Error ? err.message : String(err))
      })
    return () => {
      provider.off('display_uri', onUri)
      // Leaving the sheet mid-pairing: drop the proposal so the relay is
      // not left waiting and a late approval cannot connect behind the
      // user's back.
      if (!settled) provider.abortPairingAttempt?.()
    }
  }, [wallet, attempt])

  return {
    uri,
    error: error ?? loadError,
    retry: () => setAttempt((n) => n + 1),
    deepLinkFor: () => null,
  }
}
