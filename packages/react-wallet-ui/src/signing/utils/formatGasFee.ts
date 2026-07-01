import { formatEther } from 'viem'

const FEE_DECIMALS = 5

export function formatGasFee(wei: bigint): string {
  const ether = Number(formatEther(wei))
  const rounded = Math.round(ether * 10 ** FEE_DECIMALS) / 10 ** FEE_DECIMALS
  if (rounded === 0) return `< 0.${'0'.repeat(FEE_DECIMALS - 1)}1 ETH`
  return `${rounded} ETH`
}
