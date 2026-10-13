import type { TransactionHistoryItem } from '@zerodev/wallet-data'
import { quantity } from '../fixtures'
import { eth, tx, usdc } from './builders'

const { symbol: _symbol, ...usdcWithoutSymbol } = usdc('ethereum')
const { name: _name, ...usdcWithoutName } = usdc('ethereum')
const { decimals: _decimals, address: _address, ...usdcBare } = usdc('ethereum')
const { imageUri: _imageUri, ...ethWithoutImage } = eth('ethereum')

export const tokenGaps = [
  tx(400, {
    operation: 'send',
    status: 'success',
    token: usdcWithoutSymbol,
    quantity: quantity(25, 6),
  }),
  tx(401, {
    operation: 'receive',
    status: 'success',
    token: usdcWithoutName,
    quantity: quantity(12, 6),
  }),
  tx(402, {
    operation: 'receive',
    status: 'success',
    token: { ...usdc('ethereum'), priceUsd: null },
    quantity: quantity(99.99, 6),
  }),
  tx(403, {
    operation: 'deposit',
    status: 'success',
    token: usdcBare,
    quantity: quantity(5, 6),
  }),
  tx(404, {
    operation: 'send',
    status: 'success',
    token: ethWithoutImage,
    quantity: quantity(0.05, 18),
  }),
  tx(405, {
    operation: 'mint',
    status: 'success',
    nft: { tokenId: '9001', imageUri: 'https://cdn.zerion.io/nft/9001.png' },
  }),
  tx(406, {
    operation: 'receive',
    status: 'success',
    nft: { tokenId: '77', name: 'Imageless Collectible #77' },
  }),
] satisfies readonly TransactionHistoryItem[]
