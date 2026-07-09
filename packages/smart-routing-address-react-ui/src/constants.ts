import type { TOKEN_TYPE } from '@zerodev/smart-routing-address'
import { SUPPORTED_TOKENS } from '@zerodev/smart-routing-address'
import type { Chain } from 'viem'
import {
  arbitrum,
  base,
  blast,
  bsc,
  celo,
  flowMainnet,
  hyperEvm,
  ink,
  linea,
  mainnet,
  megaeth,
  mode,
  monad,
  optimism,
  plasma,
  polygon,
  scroll,
  soneium,
  tempo,
  unichain,
  worldchain,
  zora,
} from 'viem/chains'
import type { SourceToken } from './types'

export const DEFAULT_POLLING_INTERVAL_MS = 5_000

export const DEFAULT_FILL_TIME_SECONDS = 30

export const DEFAULT_DASHBOARD_URL = 'https://smart-routing-address.zerodev.app'

/**
 * Chains supported by the smart routing address SDK; mirrors the
 * smart-account-plus core `supportedChainIds` list.
 */
export const SUPPORTED_CHAINS: readonly Chain[] = [
  mainnet,
  optimism,
  arbitrum,
  polygon,
  plasma,
  base,
  celo,
  mode,
  monad,
  blast,
  bsc,
  flowMainnet,
  hyperEvm,
  linea,
  ink,
  megaeth,
  scroll,
  soneium,
  tempo,
  unichain,
  worldchain,
  zora,
]

export const CHAINS_BY_ID: ReadonlyMap<number, Chain> = new Map(
  SUPPORTED_CHAINS.map((chain) => [chain.id, chain]),
)

/**
 * Source tokens offered for deposits: every
 * supported mainnet token the SDK exposes (NATIVE plus each ERC-20, with
 * wrapped native surfaced as WETH), mapped to its viem chain object. Testnets
 * are excluded from the default; chains this package cannot resolve to a viem
 * chain are skipped.
 */
export const DEFAULT_SOURCE_TOKENS: SourceToken[] = Object.entries(
  SUPPORTED_TOKENS,
).flatMap(([chainId, tokens]) => {
  // Skip chains this package cannot resolve to a viem chain object
  const chain = CHAINS_BY_ID.get(Number(chainId))
  if (!chain) return []
  return Object.keys(tokens).map((tokenType) => ({
    chain,
    tokenType: tokenType as TOKEN_TYPE,
  }))
})
