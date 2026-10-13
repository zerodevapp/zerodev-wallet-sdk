import type {
  TransactionHistoryChain,
  TransactionHistoryToken,
  TransactionHistoryTransaction,
  UnparsedTransactionHistoryItem,
} from '@zerodev/wallet-data'
import { ETH, USDC } from '../fixtures'

const TRUSTWALLET =
  'https://raw.githubusercontent.com/trustwallet/assets/master'
const ETHEREUM_ICON = `${TRUSTWALLET}/blockchains/ethereum/info/logo.png`
const ARBITRUM_ICON = `${TRUSTWALLET}/blockchains/arbitrum/info/logo.png`

export const HOUR = 3600
export const DAY = 24 * HOUR
/** 2026-09-21T12:00:00Z, in Unix seconds. */
export const FIXED_MIDDAY = 1_789_992_000

/** Midday UTC of the day containing `nowMs`, in Unix seconds. */
export function middayOf(nowMs: number): number {
  return Math.floor(nowMs / 1000 / DAY) * DAY + 12 * HOUR
}

interface ChainSpec {
  id: string
  name: string
  iconUri?: string
  explorerTxBase?: string
}

const CHAINS = {
  ethereum: {
    id: 'ethereum',
    name: 'Ethereum',
    iconUri: ETHEREUM_ICON,
    explorerTxBase: 'https://etherscan.io/tx/',
  },
  arbitrum: {
    id: 'arbitrum',
    name: 'Arbitrum',
    iconUri: ARBITRUM_ICON,
    explorerTxBase: 'https://arbiscan.io/tx/',
  },
  'ethereum-sepolia': {
    id: 'ethereum-sepolia',
    name: 'Ethereum Sepolia',
    iconUri: ETHEREUM_ICON,
    explorerTxBase: 'https://sepolia.etherscan.io/tx/',
  },
  noExplorer: { id: 'ethereum', name: 'Ethereum', iconUri: ETHEREUM_ICON },
  noIcon: {
    id: 'arbitrum',
    name: 'Arbitrum',
    explorerTxBase: 'https://arbiscan.io/tx/',
  },
  longName: {
    id: 'polygon-zkevm-cardona',
    name: 'Polygon zkEVM Cardona Testnet Rollup Network',
    iconUri: ETHEREUM_ICON,
    explorerTxBase: 'https://cardona-zkevm.polygonscan.com/tx/',
  },
  unknown: { id: 'chain-424242', name: 'Unknown network' },
} as const satisfies Record<string, ChainSpec>

export type ChainKey = keyof typeof CHAINS

export function hash(n: number): string {
  return `0x${n.toString(16).padStart(64, '0')}`
}

export function chain(key: ChainKey, txHash: string): TransactionHistoryChain {
  const spec: ChainSpec = CHAINS[key]
  return {
    id: spec.id,
    name: spec.name,
    ...(spec.iconUri && { iconUri: spec.iconUri }),
    ...(spec.explorerTxBase && {
      explorerTxUrl: `${spec.explorerTxBase}${txHash}`,
    }),
  }
}

export function token(
  base: TransactionHistoryToken,
  key: ChainKey,
  overrides: Partial<TransactionHistoryToken> = {},
): TransactionHistoryToken {
  return { ...base, chainId: CHAINS[key].id, ...overrides }
}

export const ETH_LOGO = ETHEREUM_ICON
export const USDC_LOGO = `${TRUSTWALLET}/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png`

export const eth = (key: ChainKey) => token(ETH, key, { imageUri: ETH_LOGO })
export const usdc = (key: ChainKey) => token(USDC, key, { imageUri: USDC_LOGO })
export const dai = (key: ChainKey) =>
  token(USDC, key, {
    name: 'Dai Stablecoin',
    symbol: 'DAI',
    address: '0x6b175474e89094c44da98b954eedeac495271d0f',
    decimals: 18,
    imageUri: `${TRUSTWALLET}/blockchains/ethereum/assets/0x6B175474E89094C44Da98b954EedeAC495271d0F/logo.png`,
  })

export type TxFields = Omit<
  TransactionHistoryTransaction,
  'id' | 'chainId' | 'chain' | 'timestamp' | 'txHash'
>

/**
 * `n` names the transaction. By default it also sets the timestamp: the last
 * two digits step back five minutes from FIXED_MIDDAY, so each scenario's
 * block of numbers (100s, 200s, ...) clusters on one local day.
 */
export function tx(
  n: number,
  fields: TxFields,
  key: ChainKey = 'ethereum',
  timestamp: number = FIXED_MIDDAY - (n % 100) * 300,
): TransactionHistoryTransaction {
  const txHash = hash(n)
  return {
    id: `tx-${n}`,
    chainId: CHAINS[key].id,
    chain: chain(key, txHash),
    timestamp,
    txHash,
    ...fields,
  }
}

export function unparsed(
  n: number,
  { key, timestamp }: { key?: ChainKey; timestamp?: number },
): UnparsedTransactionHistoryItem {
  const txHash = hash(n)
  return {
    kind: 'unparsed',
    txHash,
    ...(key && { chainId: CHAINS[key].id, chain: chain(key, txHash) }),
    ...(timestamp !== undefined && { timestamp }),
  }
}
