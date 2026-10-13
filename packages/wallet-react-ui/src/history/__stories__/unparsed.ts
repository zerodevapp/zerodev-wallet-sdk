import type { TransactionHistoryItem } from '@zerodev/wallet-data'
import { quantity } from '../fixtures'
import { FIXED_MIDDAY, tx, unparsed as unparsedItem, usdc } from './builders'

/** The two items without a timestamp are dropped from the list. */
export const unparsed = [
  tx(300, {
    operation: 'send',
    status: 'success',
    token: usdc('ethereum'),
    quantity: quantity(25, 6),
  }),
  unparsedItem(301, { key: 'arbitrum', timestamp: FIXED_MIDDAY - 300 }),
  unparsedItem(302, { timestamp: FIXED_MIDDAY - 600 }),
  unparsedItem(303, { key: 'ethereum' }),
  unparsedItem(304, {}),
] satisfies readonly TransactionHistoryItem[]
