import type { SolanaChain } from '@solana/wallet-standard-chains'
import type { Wallet, WalletAccount } from '@wallet-standard/base'
import type {
  StandardConnectFeature,
  StandardDisconnectFeature,
  StandardEventsFeature,
} from '@wallet-standard/features'

/**
 * A Wallet Standard wallet the kit can connect for Solana: it exposes
 * `standard:connect` and lists at least one `solana:*` chain. Disconnect and
 * events are optional in the standard, so they stay optional here.
 */
export type SolanaStandardWallet = Omit<Wallet, 'features'> & {
  readonly features: StandardConnectFeature &
    Partial<StandardDisconnectFeature & StandardEventsFeature>
}

/** How the kit reached the connected Solana wallet. WalletConnect is the
 * planned second door (RFC phase 2); only the Wallet Standard path exists. */
export type SolanaConnectionSource = 'standard'

export type SolanaConnectionStatus = 'disconnected' | 'connecting' | 'connected'

/**
 * The connected Solana wallet, as the host app consumes it. The kit signs
 * nothing: hosts take `wallet` + `account` and sign through the wallet's own
 * `solana:*` features (for example with `@solana/kit`).
 */
export type SolanaConnection = {
  source: SolanaConnectionSource
  wallet: SolanaStandardWallet
  account: WalletAccount
  /** Base58 address, exactly as the wallet reports it. Never lowercased. */
  address: string
  publicKey: Uint8Array
  /** The `solana:*` chains this account can be used on. */
  chains: readonly SolanaChain[]
}
