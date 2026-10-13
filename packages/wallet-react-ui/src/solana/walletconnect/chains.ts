import {
  SOLANA_DEVNET_CHAIN,
  SOLANA_MAINNET_CHAIN,
  SOLANA_TESTNET_CHAIN,
  type SolanaChain,
} from '@solana/wallet-standard-chains'

/**
 * WalletConnect names Solana clusters by CAIP-2 id (`solana:` + the first 32
 * base58 characters of the cluster's genesis hash); the Wallet Standard uses
 * `solana:mainnet`-style names. Both directions are needed: proposing a
 * session and reading its accounts speak CAIP-2, the kit's connection and
 * the host's signing calls speak Wallet Standard names.
 */
export const SOLANA_CAIP2 = {
  mainnet: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
  devnet: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
  testnet: 'solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z',
  /** Ids from before the genesis-hash convention; some wallets still
   * advertise them, so a session proposal lists them too. */
  deprecatedMainnet: 'solana:4sGjMW1sUnHzSxGspuhpqLDx6wiyjNtZ',
  deprecatedDevnet: 'solana:8E9rvCKLFQia2Y35HXjjpWzj8weVo44K',
} as const

const CAIP2_TO_CHAIN: Record<string, SolanaChain> = {
  [SOLANA_CAIP2.mainnet]: SOLANA_MAINNET_CHAIN,
  [SOLANA_CAIP2.deprecatedMainnet]: SOLANA_MAINNET_CHAIN,
  [SOLANA_CAIP2.devnet]: SOLANA_DEVNET_CHAIN,
  [SOLANA_CAIP2.deprecatedDevnet]: SOLANA_DEVNET_CHAIN,
  [SOLANA_CAIP2.testnet]: SOLANA_TESTNET_CHAIN,
}

const CHAIN_TO_CAIP2: Partial<Record<SolanaChain, string>> = {
  [SOLANA_MAINNET_CHAIN]: SOLANA_CAIP2.mainnet,
  [SOLANA_DEVNET_CHAIN]: SOLANA_CAIP2.devnet,
  [SOLANA_TESTNET_CHAIN]: SOLANA_CAIP2.testnet,
}

/** The Wallet Standard chain for a CAIP-2 id, or undefined for an unknown
 * cluster (localnet has no CAIP-2 id). */
export function caip2ToSolanaChain(caip2: string): SolanaChain | undefined {
  return CAIP2_TO_CHAIN[caip2]
}

/** The canonical CAIP-2 id for a Wallet Standard chain, or undefined. */
export function solanaChainToCaip2(chain: SolanaChain): string | undefined {
  return CHAIN_TO_CAIP2[chain]
}

/** What a session proposal asks for: mainnet and devnet under both the
 * current and the deprecated ids, so either kind of wallet can approve. */
export const SOLANA_WALLETCONNECT_CHAINS: readonly string[] = [
  SOLANA_CAIP2.mainnet,
  SOLANA_CAIP2.devnet,
  SOLANA_CAIP2.deprecatedMainnet,
]

/** The JSON-RPC methods proposed for WalletConnect's `solana` namespace: the
 * three the kit relays, plus the account methods wallets expect a proposal
 * to carry (MetaMask's adapter answers them during the handshake) and
 * `signAllTransactions`, which has no Wallet Standard counterpart but is
 * what Reown AppKit proposes too, so wallets see a familiar shape. */
export const SOLANA_WALLETCONNECT_METHODS = [
  'solana_requestAccounts',
  'solana_getAccounts',
  'solana_signMessage',
  'solana_signTransaction',
  'solana_signAllTransactions',
  'solana_signAndSendTransaction',
] as const

export const SOLANA_WALLETCONNECT_EVENTS = [
  'accountsChanged',
  'chainChanged',
] as const

/** A session account is `solana:<caip2 reference>:<base58 pubkey>`. */
export function parseSessionAccount(
  account: string,
): { caip2: string; address: string } | undefined {
  const parts = account.split(':')
  if (parts.length !== 3 || parts[0] !== 'solana') return undefined
  return { caip2: `${parts[0]}:${parts[1]}`, address: parts[2] as string }
}
