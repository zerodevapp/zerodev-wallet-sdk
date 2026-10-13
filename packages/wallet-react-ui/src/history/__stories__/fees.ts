import type { TransactionHistoryItem } from '@zerodev/wallet-data'
import { quantity } from '../fixtures'
import { dai, eth, tx, usdc } from './builders'

const send = {
  operation: 'send',
  status: 'success',
  token: usdc('ethereum'),
  quantity: quantity(25, 6),
} as const

/** Protocol fees use distinct tokens; the details rows key on token and amount. */
export const fees = [
  tx(500, {
    ...send,
    fees: {
      network: { token: eth('ethereum'), quantity: quantity(0.00021, 18) },
    },
  }),
  tx(501, {
    ...send,
    fees: {
      network: {
        token: { ...eth('ethereum'), priceUsd: null },
        quantity: quantity(0.00021, 18),
      },
    },
  }),
  tx(502, {
    ...send,
    fees: { network: { token: eth('ethereum'), quantity: quantity(0, 18) } },
  }),
  tx(503, {
    operation: 'swap',
    status: 'success',
    token: eth('ethereum'),
    quantity: quantity(1, 18),
    destToken: usdc('ethereum'),
    destQuantity: quantity(2498.12, 6),
    fees: {
      network: { token: eth('ethereum'), quantity: quantity(0.00042, 18) },
      protocol: [
        { token: usdc('ethereum'), quantity: quantity(2.5, 6) },
        { token: dai('ethereum'), quantity: quantity(1.25, 18) },
      ],
    },
  }),
  tx(504, send),
] satisfies readonly TransactionHistoryItem[]
