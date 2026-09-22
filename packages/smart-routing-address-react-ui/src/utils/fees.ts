import type { TOKEN_TYPE } from '@zerodev/smart-routing-address'
import { SUPPORTED_TOKENS } from '@zerodev/smart-routing-address'
import type { Address } from 'viem'
import { isAddressEqual, zeroAddress } from 'viem'
import type { EstimatedFee, EstimatedFeeData } from '../types'

/**
 * Resolve the on-chain token address used by the routing server for a given
 * token type on a chain. Returns null when the type cannot be resolved
 * (generic ERC20 or unknown token on that chain).
 */
export function resolveTokenAddress(
  tokenType: TOKEN_TYPE,
  chainId: number,
): Address | null {
  if (tokenType === 'NATIVE') return zeroAddress
  if (tokenType === 'ERC20') return null
  return SUPPORTED_TOKENS[chainId]?.[tokenType] ?? null
}

/** Whether the token type resolves to the given on-chain address on a chain. */
export function tokenAddressMatches(
  tokenType: TOKEN_TYPE,
  chainId: number,
  token: Address,
): boolean {
  const address = resolveTokenAddress(tokenType, chainId)
  return address !== null && isAddressEqual(address, token)
}

export function findFeeDataByToken(
  estimatedFees: EstimatedFee[],
  chainId: number,
  token: Address,
): EstimatedFeeData | null {
  const chainFees = estimatedFees.find((fee) => fee.chainId === chainId)
  if (!chainFees) return null
  return (
    chainFees.data.find((data) => isAddressEqual(data.token, token)) ?? null
  )
}

export function findFeeData(
  estimatedFees: EstimatedFee[],
  chainId: number,
  tokenType: TOKEN_TYPE,
): EstimatedFeeData | null {
  const token = resolveTokenAddress(tokenType, chainId)
  if (!token) return null
  return findFeeDataByToken(estimatedFees, chainId, token)
}
