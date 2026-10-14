import { equalsIgnoreCase } from '../shared/utils/common'
import type { SolanaConnection } from './types'

/** The slice of a Wallet Standard UI wallet (`@wallet-standard/react`'s
 * `useWallets()` entries) needed to find the kit's connected account. */
export type SolanaUiWalletLike<A extends { address: string }> = {
  name: string
  accounts: readonly A[]
}

/**
 * Find the kit's connected Solana account among the UI wallets of an app
 * built on `@wallet-standard/react` and `@solana/react`. Those hooks hold
 * no selection of their own: the app passes an account into
 * `useWalletAccountTransactionSigner` and friends, so this is the whole
 * bridge for a Kit-based app. Returns undefined while disconnected or when
 * the wallet is not in the list (a WalletConnect session, say).
 */
export function findSolanaUiAccount<A extends { address: string }>(
  wallets: readonly SolanaUiWalletLike<A>[],
  connection: SolanaConnection | null,
): A | undefined {
  if (!connection) return undefined
  return wallets
    .find((w) => equalsIgnoreCase(w.name, connection.wallet.name))
    ?.accounts.find((a) => a.address === connection.address)
}
