import type { TransactionHistoryItem } from '@zerodev/wallet-data'
import { quantity } from '../fixtures'
import { type ChainKey, dai, eth, type TxFields, tx, usdc } from './builders'

const fee = (key: ChainKey) => ({
  network: { token: eth(key), quantity: quantity(0.00021, 18) },
})

/** One row per operation, plus a one-sided swap next to the two-sided one. */
export const ALL_OPERATION_SPECS: readonly {
  key: ChainKey
  fields: TxFields
}[] = [
  {
    key: 'ethereum',
    fields: {
      operation: 'approve',
      status: 'success',
      nft: { tokenId: '7', name: 'ZeroDev Pass #7' },
      fees: fee('ethereum'),
    },
  },
  {
    key: 'ethereum',
    fields: {
      operation: 'bid',
      status: 'pending',
      nft: { tokenId: '1024', name: 'Pudgy Penguin #1024' },
      token: eth('ethereum'),
      quantity: quantity(0.75, 18),
    },
  },
  {
    key: 'arbitrum',
    fields: {
      operation: 'burn',
      status: 'success',
      token: usdc('arbitrum'),
      quantity: quantity(10, 6),
      fees: fee('arbitrum'),
    },
  },
  {
    key: 'arbitrum',
    fields: {
      operation: 'claim',
      status: 'success',
      token: dai('arbitrum'),
      quantity: quantity(42.5, 18),
    },
  },
  {
    key: 'ethereum',
    fields: { operation: 'delegate', status: 'success', fees: fee('ethereum') },
  },
  {
    key: 'ethereum',
    fields: { operation: 'deploy', status: 'success', fees: fee('ethereum') },
  },
  {
    key: 'arbitrum',
    fields: {
      operation: 'deposit',
      status: 'success',
      token: eth('arbitrum'),
      quantity: quantity(1.25, 18),
    },
  },
  {
    key: 'arbitrum',
    fields: { operation: 'execute', status: 'success', fees: fee('arbitrum') },
  },
  {
    key: 'ethereum',
    fields: {
      operation: 'mint',
      status: 'success',
      nft: { tokenId: '42', name: 'ZeroDev Pass #42' },
      fees: fee('ethereum'),
    },
  },
  {
    key: 'ethereum',
    fields: {
      operation: 'receive',
      status: 'success',
      token: eth('ethereum'),
      quantity: quantity(0.5, 18),
    },
  },
  {
    key: 'arbitrum',
    fields: {
      operation: 'revoke',
      status: 'success',
      token: usdc('arbitrum'),
      fees: fee('arbitrum'),
    },
  },
  {
    key: 'ethereum',
    fields: {
      operation: 'revoke_delegation',
      status: 'success',
      fees: fee('ethereum'),
    },
  },
  {
    key: 'ethereum',
    fields: {
      operation: 'send',
      status: 'success',
      token: usdc('ethereum'),
      quantity: quantity(25, 6),
      fees: fee('ethereum'),
    },
  },
  {
    key: 'arbitrum',
    fields: {
      operation: 'swap',
      status: 'success',
      token: eth('arbitrum'),
      quantity: quantity(1, 18),
      destToken: usdc('arbitrum'),
      destQuantity: quantity(2498.12, 6),
      fees: {
        ...fee('arbitrum'),
        protocol: [{ token: usdc('arbitrum'), quantity: quantity(2.5, 6) }],
      },
    },
  },
  {
    key: 'ethereum',
    fields: {
      operation: 'swap',
      status: 'success',
      token: dai('ethereum'),
      quantity: quantity(500, 18),
      fees: fee('ethereum'),
    },
  },
  {
    key: 'arbitrum',
    fields: {
      operation: 'withdraw',
      status: 'success',
      token: usdc('arbitrum'),
      quantity: quantity(150, 6),
    },
  },
  {
    key: 'ethereum',
    fields: { operation: 'other', status: 'success' },
  },
]

export const allOperations = ALL_OPERATION_SPECS.map(({ key, fields }, i) =>
  tx(100 + i, fields, key),
) satisfies readonly TransactionHistoryItem[]
