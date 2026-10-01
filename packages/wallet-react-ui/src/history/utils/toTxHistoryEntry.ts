import type { IconName } from '@zerodev/react-ui'
import type {
  TransactionHistoryItem,
  TransactionHistoryOperation,
  TransactionHistoryQuantity,
  TransactionHistoryStatus,
  TransactionHistoryTransaction,
} from '@zerodev/wallet-data'
import type { TxHistoryEntry, TxHistoryStatus } from '../types'

const OPERATION: Record<
  TransactionHistoryOperation,
  { verb: string; icon: IconName }
> = {
  approve: { verb: 'Approved', icon: 'patchCheck' },
  bid: { verb: 'Bid on', icon: 'tags' },
  burn: { verb: 'Burned', icon: 'flame' },
  claim: { verb: 'Claimed', icon: 'lighting' },
  delegate: { verb: 'Delegated', icon: 'user' },
  deploy: { verb: 'Deployed contract', icon: 'bezierCurve' },
  deposit: { verb: 'Deposited', icon: 'circleArrowDown' },
  execute: { verb: 'Executed', icon: 'transaction' },
  mint: { verb: 'Minted', icon: 'stars' },
  receive: { verb: 'Received', icon: 'circleArrowDown' },
  revoke: { verb: 'Revoked', icon: 'x' },
  revoke_delegation: { verb: 'Revoked delegation', icon: 'x' },
  send: { verb: 'Sent', icon: 'circleArrowUp' },
  swap: { verb: 'Swapped', icon: 'arrowSwapHorizontalOutline' },
  withdraw: { verb: 'Withdrew', icon: 'circleArrowUp' },
  other: { verb: 'Transaction', icon: 'transaction' },
}

export const TX_HISTORY_STATUS: Record<
  TransactionHistoryStatus,
  TxHistoryStatus
> = {
  pending: 'Pending',
  success: 'Success',
  failed: 'Failed',
  unknown: 'Unknown',
}

export function formatQuantity(q: TransactionHistoryQuantity): string {
  return q.float.toLocaleString('en-US', { maximumSignificantDigits: 6 })
}

function title(tx: TransactionHistoryTransaction): string {
  const { verb } = OPERATION[tx.operation]
  if (tx.operation === 'swap' && tx.token?.symbol && tx.destToken?.symbol) {
    return `Swapped ${tx.token.symbol} → ${tx.destToken.symbol}`
  }
  if (tx.nft) return `${verb} NFT`
  if (tx.token?.symbol) return `${verb} ${tx.token.symbol}`
  return verb
}

function value(tx: TransactionHistoryTransaction): string | undefined {
  if (tx.nft) return tx.nft.name ?? `#${tx.nft.tokenId}`
  const side =
    tx.operation === 'swap' && tx.destQuantity && tx.destToken
      ? { quantity: tx.destQuantity, token: tx.destToken }
      : tx.quantity && tx.token
        ? { quantity: tx.quantity, token: tx.token }
        : undefined
  if (!side) return undefined
  return `${formatQuantity(side.quantity)} ${side.token.symbol ?? ''}`.trim()
}

export function toTxHistoryEntry(
  item: TransactionHistoryItem,
): TxHistoryEntry | undefined {
  if ('kind' in item) {
    if (item.timestamp === undefined) return undefined
    return {
      id: item.txHash,
      icon: 'question',
      title: 'Unknown transaction',
      chain: item.chain ?? { name: 'Unknown network' },
      status: 'Unknown',
      timestampMs: item.timestamp * 1000,
    }
  }
  const v = value(item)
  return {
    id: item.id,
    icon: item.nft ? 'imageFill' : OPERATION[item.operation].icon,
    title: title(item),
    ...(v !== undefined && { value: v }),
    chain: item.chain,
    status: TX_HISTORY_STATUS[item.status],
    timestampMs: item.timestamp * 1000,
    transaction: item,
  }
}
