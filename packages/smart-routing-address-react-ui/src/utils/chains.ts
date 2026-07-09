import type { Chain } from 'viem'
import { CHAINS_BY_ID, SUPPORTED_CHAINS } from '../constants'

/** Resolve a chain id to its viem chain object, throwing for unknown ids */
export function getChainById(chainId: number): Chain {
  const chain = CHAINS_BY_ID.get(chainId)
  if (!chain) {
    const supported = SUPPORTED_CHAINS.map((c) => `${c.name} (${c.id})`)
    throw new Error(
      `Unsupported chain id ${chainId}. Supported chains: ${supported.join(', ')}`,
    )
  }
  return chain
}

/** Block explorer URL for a transaction, or null when no explorer is known */
export function getTxUrl(
  chainId: number,
  transactionHash: string,
): string | null {
  const explorer = CHAINS_BY_ID.get(chainId)?.blockExplorers?.default
  if (!explorer) return null
  return `${explorer.url}/tx/${transactionHash}`
}
