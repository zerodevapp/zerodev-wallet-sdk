import type { TOKEN_TYPE } from '@zerodev/smart-routing-address'
import {
  NATIVE_TOKENS_SUPPORTED,
  TOKEN_ADDRESSES,
} from '@zerodev/smart-routing-address'
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
 * Token types the SDK ships in `TOKEN_ADDRESSES` but the SRA server does not
 * yet recognize. Sending one of these as a source token makes the server
 * reject the whole `createSmartRoutingAddress` request with
 * `Invalid params: Token address … is not supported on chain N`, which breaks
 * the entire destination (e.g. Base). Remove entries here as the server
 * registry catches up.
 *
 * TODO: file/track ZeroDev SRA server bug for EURC on Base
 * (chain 8453, address 0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42) — once the
 * server accepts it, drop this filter.
 */
const UNSUPPORTED_TOKEN_TYPES: ReadonlySet<TOKEN_TYPE> = new Set(['EURC'])

/**
 * Per-chain (source chain → token types) the SDK still ships but no route
 * exists for. Like `UNSUPPORTED_TOKEN_TYPES`, remove entries once routes
 * come back.
 *
 * - Soneium USDT: deprecated by Across, so deposits from it can't bridge.
 */
const UNSUPPORTED_CHAIN_TOKENS: ReadonlyMap<
  number,
  ReadonlySet<TOKEN_TYPE>
> = new Map([[soneium.id, new Set<TOKEN_TYPE>(['USDT'])]])

/**
 * Source tokens offered for deposits: every supported mainnet token the SDK
 * exposes (NATIVE where the chain supports it, plus each ERC-20 in the
 * token-address map, with wrapped native surfaced as WETH), mapped to its
 * viem chain object. Testnets are excluded from the default; chains this
 * package cannot resolve to a viem chain are skipped, and token types the
 * server can't route are filtered via `UNSUPPORTED_TOKEN_TYPES` (all
 * chains) and `UNSUPPORTED_CHAIN_TOKENS` (per chain).
 */
export const DEFAULT_SOURCE_TOKENS: SourceToken[] = Object.entries(
  TOKEN_ADDRESSES,
).flatMap(([chainId, tokens]) => {
  // Skip chains this package cannot resolve to a viem chain object
  const chain = CHAINS_BY_ID.get(Number(chainId))
  if (!chain) return []
  // NATIVE left the token-address map in v1; native support is its own list
  const native = (NATIVE_TOKENS_SUPPORTED as readonly number[]).includes(
    chain.id,
  )
  return (
    [...(native ? ['NATIVE'] : []), ...Object.keys(tokens)]
      .filter((t) => !UNSUPPORTED_TOKEN_TYPES.has(t as TOKEN_TYPE))
      .filter(
        (t) => !UNSUPPORTED_CHAIN_TOKENS.get(chain.id)?.has(t as TOKEN_TYPE),
      )
      // v1 lists WRAPPED_NATIVE alongside WETH; on ETH-native chains both
      // point at the same contract, which would duplicate the picker entry —
      // keep the WETH surface, as before v1
      .filter(
        (t) =>
          t !== 'WRAPPED_NATIVE' ||
          tokens.WRAPPED_NATIVE?.toLowerCase() !== tokens.WETH?.toLowerCase(),
      )
      .map((tokenType) => ({
        chain,
        tokenType: tokenType as TOKEN_TYPE,
      }))
  )
})
