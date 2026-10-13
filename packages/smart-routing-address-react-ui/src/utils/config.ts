import type {
  CALL,
  SmartRoutingAddressVersion,
  TOKEN_TYPE,
} from '@zerodev/smart-routing-address'
import {
  createCall,
  FLEX,
  SMART_ROUTING_ADDRESS_V1_0_0,
  SUPPORTED_TOKENS,
} from '@zerodev/smart-routing-address'
import { type Address, type Chain, erc20Abi } from 'viem'
import { DEFAULT_DASHBOARD_URL, DEFAULT_SOURCE_TOKENS } from '../constants'
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
  return config.version ?? SMART_ROUTING_ADDRESS_V1_0_0
}

export function resolveDashboardUrl(address?: string): string {
  if (!address) return DEFAULT_DASHBOARD_URL
  return `${DEFAULT_DASHBOARD_URL.replace(/\/+$/, '')}/address/${address}`
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
 *
 * v0.x managers additionally run `fallBack` when `action` reverts, so legacy
 * versions get the same calls as the fallback; v1 managers have no fallback
 * and reject the field.
 */
export function resolveActions(
  config: SmartRoutingAddressConfig,
  recipient: Address,
  version: SmartRoutingAddressVersion,
): { [key in TOKEN_TYPE]?: { action: CALL[]; fallBack?: CALL[] } } {
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
  const legacy = version !== SMART_ROUTING_ADDRESS_V1_0_0

  return Object.fromEntries(
    uniqueTokenTypes(resolveSourceTokens(config)).map((tokenType) => {
      const action = tokenType === 'NATIVE' ? [nativeCall] : [erc20Call]
      return [tokenType, { action, ...(legacy && { fallBack: action }) }]
    }),
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
