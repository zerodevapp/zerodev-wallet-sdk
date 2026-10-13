import type { TransactionHistoryItem } from '@zerodev/wallet-data'
import { quantity } from '../fixtures'
import { eth, tx, usdc } from './builders'

const SEPOLIA = 'ethereum-sepolia'

export const testnet = [
  tx(
    700,
    {
      operation: 'receive',
      status: 'success',
      token: eth(SEPOLIA),
      quantity: quantity(0.5, 18),
    },
    SEPOLIA,
  ),
  tx(
    701,
    {
      operation: 'send',
      status: 'success',
      token: usdc(SEPOLIA),
      quantity: quantity(25, 6),
    },
    SEPOLIA,
  ),
  tx(
    702,
    {
      operation: 'swap',
      status: 'success',
      token: eth(SEPOLIA),
      quantity: quantity(0.1, 18),
      destToken: usdc(SEPOLIA),
      destQuantity: quantity(249.8, 6),
    },
    SEPOLIA,
  ),
  tx(
    703,
    {
      operation: 'mint',
      status: 'success',
      nft: { tokenId: '1', name: 'Sepolia Test NFT #1' },
    },
    SEPOLIA,
  ),
  tx(704, { operation: 'deploy', status: 'success' }, SEPOLIA),
  tx(
    705,
    {
      operation: 'send',
      status: 'pending',
      token: eth(SEPOLIA),
      quantity: quantity(0.01, 18),
    },
    SEPOLIA,
  ),
] satisfies readonly TransactionHistoryItem[]
