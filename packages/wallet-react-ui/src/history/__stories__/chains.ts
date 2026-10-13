import type { TransactionHistoryItem } from '@zerodev/wallet-data'
import { quantity } from '../fixtures'
import { eth, tx, usdc } from './builders'

export const chains = [
  tx(
    600,
    {
      operation: 'send',
      status: 'success',
      token: usdc('noExplorer'),
      quantity: quantity(25, 6),
    },
    'noExplorer',
  ),
  tx(
    601,
    {
      operation: 'receive',
      status: 'success',
      token: eth('noIcon'),
      quantity: quantity(0.5, 18),
    },
    'noIcon',
  ),
  tx(
    602,
    {
      operation: 'send',
      status: 'pending',
      token: eth('longName'),
      quantity: quantity(0.1, 18),
    },
    'longName',
  ),
  tx(603, { operation: 'execute', status: 'success' }, 'unknown'),
] satisfies readonly TransactionHistoryItem[]
