import type { IconName } from '../../shared/components/Icon'

/**
 * Maps wagmi `Chain.id` to a kit `Icon` name. Mainnets and their testnet
 * counterparts share the same logo. Returns `undefined` for unknown chains
 * (the caller can either omit the icon or pick its own fallback).
 */
const CHAIN_ICON_BY_ID: Record<number, IconName> = {
  1: 'ethereum',
  11155111: 'ethereum', // sepolia
  42161: 'arbitrum',
  421614: 'arbitrum', // arbitrumSepolia
}

export function getChainIcon(
  chainId: number | undefined,
): IconName | undefined {
  if (chainId === undefined) return undefined
  return CHAIN_ICON_BY_ID[chainId]
}
