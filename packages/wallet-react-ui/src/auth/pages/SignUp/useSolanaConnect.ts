import { useState } from 'react'
import { useConfig } from 'wagmi'
import { useStore } from 'zustand'
import { useKitStore } from '../../../shared/hooks/useKitStore'
import { withoutEvmAdoption } from '../../../solana/evmAdoptionGuard'
import type { SolanaStandardWallet } from '../../../solana/types'
import { useAuth } from '../../hooks/useAuth'
import { isCancellationError } from '../../utils/isCancellationError'
import { useReportPending, useSignUpContext } from './context'

/**
 * Connect flow for a Solana (Wallet Standard) wallet from inside a `SignUp.*`
 * unit: guards the consent gate and the page-level pending lock, connects
 * through the wallet's `standard:connect` into the kit store's Solana slot,
 * and closes the sign-up flow on success — the same end state as an EVM
 * wallet connection. A declined prompt is the user's choice and is swallowed;
 * any other failure goes to the page's error takeover.
 */
export function useSolanaConnect() {
  const { authPending, guardAgreement, setError } = useSignUpContext()
  const { goToStep } = useAuth()
  const store = useKitStore()
  const wagmiConfig = useConfig()
  const status = useStore(store, (s) => s.solana.status)
  const connectedName = useStore(store, (s) => s.solana.connection?.wallet.name)

  const [pendingName, setPendingName] = useState<string | null>(null)
  useReportPending(pendingName !== null)

  const connectSolana = async (wallet: SolanaStandardWallet) => {
    if (authPending || status === 'connecting') return
    if (!guardAgreement()) return
    setPendingName(wallet.name)
    try {
      // Solana only: a multichain wallet (MetaMask) authorises its EVM side
      // in the same prompt, and wagmi would adopt it on its own.
      await withoutEvmAdoption(wagmiConfig, wallet.name, () =>
        store.getState().solana.connect(wallet),
      )
      goToStep(null)
    } catch (err) {
      if (!isCancellationError(err)) {
        setError(
          err instanceof Error
            ? err.message
            : `Couldn’t connect to ${wallet.name}.`,
        )
      }
    } finally {
      setPendingName(null)
    }
  }

  return {
    connectSolana,
    /** Name of the wallet whose prompt is open, or null. */
    pendingSolanaName: pendingName,
    /** Name of the wallet in the Solana slot, or undefined. */
    connectedSolanaName: connectedName,
  }
}
