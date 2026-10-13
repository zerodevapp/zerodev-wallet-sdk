import type { TransactionHistoryItem } from '@zerodev/wallet-data'
import { quantity } from '../fixtures'
import { eth, tx, usdc } from './builders'

export const statuses = [
  tx(200, {
    operation: 'send',
    status: 'pending',
    token: eth('ethereum'),
    quantity: quantity(0.1, 18),
  }),
  tx(201, {
    operation: 'send',
    status: 'success',
    token: usdc('ethereum'),
    quantity: quantity(25, 6),
  }),
  tx(202, {
    operation: 'send',
    status: 'failed',
    token: usdc('ethereum'),
    quantity: quantity(100, 6),
  }),
  tx(203, { operation: 'execute', status: 'unknown' }),
] satisfies readonly TransactionHistoryItem[]
