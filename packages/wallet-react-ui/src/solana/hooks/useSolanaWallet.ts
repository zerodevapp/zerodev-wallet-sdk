import { useStore } from 'zustand'
import { useKitStore } from '../../shared/hooks/useKitStore'
import type { SolanaConnection } from '../types'

/**
 * The connected Solana wallet and account, for the host to sign with. The
 * kit never signs: take `wallet.features['solana:signTransaction']` (or
 * `solana:signAndSendTransaction`, `solana:signMessage`) and `account`, and
 * drive them with `@solana/kit` or `@solana/web3.js`. `null` while
 * disconnected.
 */
export function useSolanaWallet(): Pick<
  SolanaConnection,
  'wallet' | 'account'
> | null {
  const store = useKitStore()
  const connection = useStore(store, (s) => s.solana.connection)
  if (!connection) return null
  return { wallet: connection.wallet, account: connection.account }
}
