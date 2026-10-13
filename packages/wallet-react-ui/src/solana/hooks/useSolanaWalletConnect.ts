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
  /** The WalletConnect wallet, once the SDK has loaded; null before that
   * and when disabled. Whether it holds a session is `wallet.accounts`. */
  wallet: SolanaStandardWallet | null
  error: string | null
}

/**
 * The Solana-over-WalletConnect door, configured from the wagmi config's
 * `zeroDevWalletConnect({ solana: true })`. Initialises the provider on first
 * use (restoring any persisted session) and hands back the wallet the rest
 * of the kit connects through.
 */
export function useSolanaWalletConnect(): SolanaWalletConnect {
  const connectors = useConnectors()
  const stamped = connectors.find(isZeroDevWalletConnect) as
    | (ReturnType<typeof useConnectors>[number] & ZeroDevWalletConnectStamp)
    | undefined
  const params = stamped?.zdWalletConnectParams
  const enabled = !!params?.solana
  const projectId = params?.projectId

  const [wallet, setWallet] = useState<SolanaStandardWallet | null>(null)
  const [error, setError] = useState<string | null>(null)

  // biome-ignore lint/correctness/useExhaustiveDependencies: metadata/relayUrl ride with the project id; the provider is cached per id
  useEffect(() => {
    if (!enabled || !projectId || !params) return
    let disposed = false
    getSolanaWalletConnectProvider({
      projectId,
      metadata: params.metadata,
      relayUrl: params.relayUrl,
    })
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
  }, [enabled, projectId])

  return { enabled, wallet: enabled ? wallet : null, error }
}
