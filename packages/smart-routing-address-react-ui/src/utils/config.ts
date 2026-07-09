import type {
  CreateSmartRoutingAddressParams,
  SmartRoutingAddressVersion,
  TOKEN_TYPE,
} from '@zerodev/smart-routing-address'
import {
  createCall,
  FLEX,
  SMART_ROUTING_ADDRESS_SERVER_URL,
  SMART_ROUTING_ADDRESS_V0_2_1,
  SUPPORTED_TOKENS,
} from '@zerodev/smart-routing-address'
import { type Address, type Chain, erc20Abi } from 'viem'
import {
  DEFAULT_DASHBOARD_URL,
  DEFAULT_FILL_TIME_SECONDS,
  DEFAULT_POLLING_INTERVAL_MS,
  DEFAULT_SOURCE_TOKENS,
} from '../constants'
import type {
  EstimatedFee,
  SmartRoutingAddressConfig,
  SourceToken,
} from '../types'
import { getChainById } from './chains'
import { tokenAddressMatches } from './fees'

export function resolveVersion(
  config: SmartRoutingAddressConfig,
): SmartRoutingAddressVersion {
  return config.version ?? SMART_ROUTING_ADDRESS_V0_2_1
}

export function resolvePollingInterval(
  config: SmartRoutingAddressConfig,
): number {
  return config.pollingInterval ?? DEFAULT_POLLING_INTERVAL_MS
}

/**
 * Server URL for all smart routing address requests: the server root
 * (default or `config.baseUrl`) with the ZeroDev project id appended.
 * Without a project id the URL is only overridden when `config.baseUrl`
 * is set; undefined leaves the SDK default in place.
 */
export function resolveBaseUrl(
  config: SmartRoutingAddressConfig,
): string | undefined {
  if (!config.projectId) return config.baseUrl
  const root = config.baseUrl ?? SMART_ROUTING_ADDRESS_SERVER_URL
  return `${root.replace(/\/+$/, '')}/${config.projectId}`
}

export function resolveDashboardUrl(address?: string): string {
  if (!address) return DEFAULT_DASHBOARD_URL
  return `${DEFAULT_DASHBOARD_URL.replace(/\/+$/, '')}/address/${address}`
}

export function resolveFillTimeSeconds(
  config: SmartRoutingAddressConfig,
  chainId: number,
): number {
  const fillTime = config.estimatedFillTimeSeconds
  if (typeof fillTime === 'number') return fillTime
  return fillTime?.[chainId] ?? DEFAULT_FILL_TIME_SECONDS
}

/** Chain where the routed funds settle */
export function resolveDestChain(config: SmartRoutingAddressConfig): Chain {
  return getChainById(config.targetChainId)
}

/**
 * Whether the SDK can resolve the token type to an asset on the chain:
 * generic ERC20 deposits are always accepted, every other type (including
 * NATIVE) needs a SUPPORTED_TOKENS entry for the chain.
 */
function isTokenOnChain(tokenType: TOKEN_TYPE, chainId: number): boolean {
  if (tokenType === 'ERC20') return true
  return SUPPORTED_TOKENS[chainId]?.[tokenType] !== undefined
}

/**
 * The DEFAULT_SOURCE_TOKENS, excluding token types that do not exist on the
 * destination chain (the default actions deliver the deposited token type
 * there, so a missing destination token would make the deposit unfulfillable).
 */
export function resolveSourceTokens(
  config: SmartRoutingAddressConfig,
): SourceToken[] {
  const destChainId = resolveDestChain(config).id
  return DEFAULT_SOURCE_TOKENS.filter((source) =>
    isTokenOnChain(source.tokenType, destChainId),
  )
}

/**
 * Source tokens the server actually returned routes for, taken straight from
 * the fee estimates. Each returned (chain, token address) pair is matched back
 * to a DEFAULT_SOURCE_TOKENS entry to recover its TOKEN_TYPE.
 */
export function sourceTokensFromFees(
  estimatedFees: EstimatedFee[],
): SourceToken[] {
  return estimatedFees.flatMap((fee) =>
    fee.data.flatMap((data) => {
      const token = DEFAULT_SOURCE_TOKENS.find(
        (source) =>
          source.chain.id === fee.chainId &&
          tokenAddressMatches(source.tokenType, fee.chainId, data.token),
      )
      return token ? [token] : []
    }),
  )
}

function uniqueTokenTypes(sources: SourceToken[]): TOKEN_TYPE[] {
  return [...new Set(sources.map((source) => source.tokenType))]
}

/**
 * Destination actions for every resolved source token type: ERC-20 deposits
 * are transferred to the recipient and native deposits are forwarded as
 * value. FLEX placeholders are resolved by the server per deposit.
 */
export function resolveActions(
  config: SmartRoutingAddressConfig,
  recipient: Address,
): CreateSmartRoutingAddressParams['actions'] {
  const erc20Call = createCall({
    target: FLEX.TOKEN_ADDRESS,
    value: 0n,
    abi: erc20Abi,
    functionName: 'transfer',
    args: [recipient, FLEX.AMOUNT],
  })
  const nativeCall = createCall({
    target: recipient,
    value: FLEX.NATIVE_AMOUNT,
  })

  return Object.fromEntries(
    uniqueTokenTypes(resolveSourceTokens(config)).map((tokenType) => [
      tokenType,
      {
        action: tokenType === 'NATIVE' ? [nativeCall] : [erc20Call],
        fallBack: tokenType === 'NATIVE' ? [nativeCall] : [erc20Call],
      },
    ]),
  )
}

/** Display symbol for a source token (native tokens use the chain symbol) */
export function getSourceTokenSymbol(source: SourceToken): string {
  if (source.tokenType === 'NATIVE') {
    return source.chain.nativeCurrency.symbol
  }
  if (source.tokenType === 'WRAPPED_NATIVE') {
    return `W${source.chain.nativeCurrency.symbol}`
  }
  return source.tokenType
}

/**
 * Display symbol(s) for the tokens received on the target chain. With a
 * selected source this is the deposited token type itself, since the default
 * actions forward the same token type; without a selection every possible
 * target token is joined with a separator.
 */
export function getDestTokenSymbol(
  config: SmartRoutingAddressConfig,
  source?: SourceToken | null,
): string {
  const destChain = resolveDestChain(config)

  if (source) {
    return getSourceTokenSymbol({
      tokenType: source.tokenType,
      chain: destChain,
    })
  }

  const tokenTypes = uniqueTokenTypes(resolveSourceTokens(config))
  // Distinct token types can share a display symbol (WRAPPED_NATIVE vs WETH)
  const symbols = new Set(
    tokenTypes.map((tokenType) =>
      getSourceTokenSymbol({ tokenType, chain: destChain }),
    ),
  )
  return [...symbols].join(' / ')
}
