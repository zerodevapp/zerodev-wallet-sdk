import type {
  TransactionHistoryQuantity,
  TransactionHistoryToken,
  TransactionHistoryTransaction,
  UnparsedTransactionHistoryItem,
} from '@zerodev/wallet-data'

const BASE_TIMESTAMP = 1_790_000_000

function hash(n: number): string {
  return `0x${n.toString(16).padStart(64, '0')}`
}

export function quantity(
  float: number,
  decimals: number,
): TransactionHistoryQuantity {
  return {
    int: String(Math.round(float * 10 ** decimals)),
    decimals,
    float,
    numeric: String(float),
  }
}

export const ETH: TransactionHistoryToken = {
  name: 'Ether',
  symbol: 'ETH',
  decimals: 18,
  chainId: 'ethereum-sepolia',
  imageUri: 'https://cdn.zerion.io/eth.png',
  priceUsd: 2500,
}

export const USDC: TransactionHistoryToken = {
  name: 'USD Coin',
  symbol: 'USDC',
  address: '0x1c7d4b196cb0c7b01d743fbc6116a902379c7238',
  decimals: 6,
  chainId: 'ethereum-sepolia',
  imageUri: 'https://cdn.zerion.io/usdc.png',
  priceUsd: 1,
}

function transaction(
  n: number,
  fields: Omit<
    TransactionHistoryTransaction,
    'id' | 'chainId' | 'chain' | 'timestamp' | 'txHash'
  >,
): TransactionHistoryTransaction {
  const txHash = hash(n)
  return {
    id: `tx-${n}`,
    chainId: 'ethereum-sepolia',
    chain: {
      id: 'ethereum-sepolia',
      name: 'Ethereum Sepolia',
      iconUri: 'https://cdn.zerion.io/ethereum-sepolia.png',
      explorerTxUrl: `https://sepolia.etherscan.io/tx/${txHash}`,
    },
    timestamp: BASE_TIMESTAMP - n * 3600,
    txHash,
    ...fields,
  }
}

const networkFee = { token: ETH, quantity: quantity(0.00021, 18) }

export const sendTx = transaction(1, {
  operation: 'send',
  status: 'success',
  token: USDC,
  quantity: quantity(25, 6),
  fees: { network: networkFee },
})

export const receiveTx = transaction(2, {
  operation: 'receive',
  status: 'success',
  token: ETH,
  quantity: quantity(0.5, 18),
})

export const swapTx = transaction(3, {
  operation: 'swap',
  status: 'success',
  token: ETH,
  quantity: quantity(1, 18),
  destToken: USDC,
  destQuantity: quantity(2498.12, 6),
  fees: {
    network: networkFee,
    protocol: [{ token: USDC, quantity: quantity(2.5, 6) }],
  },
})

export const nftMintTx = transaction(4, {
  operation: 'mint',
  status: 'success',
  nft: {
    tokenId: '42',
    name: 'ZeroDev Pass',
    imageUri: 'https://cdn.zerion.io/nft/42.png',
  },
  fees: { network: networkFee },
})

export const approveTx = transaction(5, {
  operation: 'approve',
  status: 'success',
  token: USDC,
})

export const failedTx = transaction(6, {
  operation: 'send',
  status: 'failed',
  token: USDC,
  quantity: quantity(100, 6),
  fees: { network: networkFee },
})

export const pendingTx = transaction(7, {
  operation: 'send',
  status: 'pending',
  token: ETH,
  quantity: quantity(0.1, 18),
})

export const unknownStatusTx = transaction(8, {
  operation: 'execute',
  status: 'unknown',
})

export const deployTx = transaction(9, {
  operation: 'deploy',
  status: 'success',
  fees: { network: networkFee },
})

export const unparsedWithTimestamp: UnparsedTransactionHistoryItem = {
  kind: 'unparsed',
  txHash: hash(10),
  chainId: 'ethereum-sepolia',
  chain: { id: 'ethereum-sepolia', name: 'Ethereum Sepolia' },
  timestamp: BASE_TIMESTAMP - 10 * 3600,
}

export const unparsedWithoutTimestamp: UnparsedTransactionHistoryItem = {
  kind: 'unparsed',
  txHash: hash(11),
  chainId: 'ethereum-sepolia',
  chain: { id: 'ethereum-sepolia', name: 'Ethereum Sepolia' },
}
