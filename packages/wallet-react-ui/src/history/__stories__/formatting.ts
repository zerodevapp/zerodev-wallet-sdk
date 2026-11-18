import type { TransactionHistoryItem } from '@zerodev/wallet-data'
import { quantity } from '../fixtures'
import { DAY, eth, middayOf, token, tx, usdc } from './builders'

/*
 * Expected row values (formatQuantity, en-US):
 *
 * Today, 12:00 UTC
 *   Received SUPERCALIFRAGILISTICEXPIALIDOCIOUS  1,234.57 SUPERCALIFRAGILISTICEXPIALIDOCIOUS
 *   Minted NFT  The Extraordinarily Long Name Of A Generative Art Collection #4096
 *   Received ETH  <0.000001 ETH  (the real value is 1e-18)
 *   Received USDC  123.46B USDC  (the real value is 123456789012.123457)
 *
 * Yesterday, twelve "Received USDC" rows at 12:00 UTC:
 *   0.5, 1, 12.5, 100, 1,000, 1,234.57, 10,000, 999,999.99, 0.1235,
 *   0.000001235, 42, 7.6543 (each followed by " USDC")
 */
export const FORMATTING_EXPECTED_VALUES = [
  '1,234.57 SUPERCALIFRAGILISTICEXPIALIDOCIOUS',
  'The Extraordinarily Long Name Of A Generative Art Collection #4096',
  '<0.000001 ETH',
  '123.46B USDC',
  ...[
    '0.5',
    '1',
    '12.5',
    '100',
    '1,000',
    '1,234.57',
    '10,000',
    '999,999.99',
    '0.1235',
    '0.000001235',
    '42',
    '7.6543',
  ].map((amount) => `${amount} USDC`),
] as const

const TWELVE_AMOUNTS = [
  0.5, 1, 12.5, 100, 1000, 1234.5678, 10000, 999999.99, 0.1234567,
  0.000001234567, 42, 7.654321,
]

export function formatting(nowMs: number) {
  const today = middayOf(nowMs)
  const yesterday = today - DAY
  return [
    tx(
      800,
      {
        operation: 'receive',
        status: 'success',
        token: token(usdc('ethereum'), 'ethereum', {
          name: 'Supercalifragilistic Token',
          symbol: 'SUPERCALIFRAGILISTICEXPIALIDOCIOUS',
          priceUsd: 0.0042,
        }),
        quantity: quantity(1234.5678, 6),
      },
      'ethereum',
      today,
    ),
    tx(
      801,
      {
        operation: 'mint',
        status: 'success',
        nft: {
          tokenId: '4096',
          name: 'The Extraordinarily Long Name Of A Generative Art Collection #4096',
        },
      },
      'ethereum',
      today,
    ),
    tx(
      802,
      {
        operation: 'receive',
        status: 'success',
        token: eth('ethereum'),
        quantity: quantity(1e-18, 18),
      },
      'ethereum',
      today,
    ),
    tx(
      803,
      {
        operation: 'receive',
        status: 'success',
        token: usdc('ethereum'),
        quantity: {
          int: '123456789012123457',
          decimals: 6,
          float: 123456789012.12346,
          numeric: '123456789012.123457',
        },
      },
      'ethereum',
      today,
    ),
    ...TWELVE_AMOUNTS.map((amount, i) =>
      tx(
        810 + i,
        {
          operation: 'receive',
          status: 'success',
          token: usdc('arbitrum'),
          quantity: quantity(amount, 6),
        },
        'arbitrum',
        yesterday,
      ),
    ),
  ] satisfies readonly TransactionHistoryItem[]
}
