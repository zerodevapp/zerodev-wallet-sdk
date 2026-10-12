import { useEffect, useState } from 'react'
import { useConnectors } from 'wagmi'
import { isZeroDevWalletConnect } from '../../auth/utils/isZeroDevWalletConnect'
import type { ZeroDevWalletConnectStamp } from '../../zeroDevWalletConnect'
import type { SolanaStandardWallet } from '../types'
import { getSolanaWalletConnectProvider } from '../walletconnect/provider'
import { getSolanaWalletConnectWallet } from '../walletconnect/wallet'

export type SolanaWalletConnect = {
  /** True when the wagmi config's `zeroDevWalletConnect` has `solana` on. */
  enabled: boolean
  /** The WalletConnect wallet, once the SDK has loaded; null before that,
   * when disabled, or when `load` is false. Whether it holds a session is
   * `wallet.accounts`. */
  wallet: SolanaStandardWallet | null
  error: string | null
  /** Load the SDK again after `error` (a failed import or init). */
  retry: () => void
}

/**
 * The Solana-over-WalletConnect door, configured from the wagmi config's
 * `zeroDevWalletConnect({ solana: true })`. With `load`, initialises the
 * provider (restoring any persisted session) and hands back the wallet the
 * rest of the kit connects through; the provider is cached per project id,
 * so every caller gets the same wallet. Without `load`, only `enabled` is
 * answered, at no cost: a second WalletConnect core is worth starting only
 * when a pairing or a restore needs it.
 */
export function useSolanaWalletConnect(load = true): SolanaWalletConnect {
  const connectors = useConnectors()
  const params = (
    connectors.find(isZeroDevWalletConnect) as
      | (ReturnType<typeof useConnectors>[number] & ZeroDevWalletConnectStamp)
      | undefined
  )?.zdWalletConnectParams
  const enabled = !!params?.solana

  const [wallet, setWallet] = useState<SolanaStandardWallet | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  // biome-ignore lint/correctness/useExhaustiveDependencies: the provider is cached per project id, so the rest of `params` cannot change it; `attempt` is the retry trigger
  useEffect(() => {
    if (!enabled || !load || !params) return
    let disposed = false
    setError(null)
    getSolanaWalletConnectProvider(params)
      .then((provider) => {
        if (!disposed) setWallet(getSolanaWalletConnectWallet(provider))
      })
      .catch((err) => {
        if (!disposed)
          setError(err instanceof Error ? err.message : String(err))
      })
    return () => {
      disposed = true
    }
  }, [enabled, load, params?.projectId, attempt])

  return {
    enabled,
    wallet: enabled && load ? wallet : null,
    error,
    retry: () => setAttempt((n) => n + 1),
  }
}
