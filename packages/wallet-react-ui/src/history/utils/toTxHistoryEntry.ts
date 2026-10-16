import type { IconName } from '@zerodev/react-ui'
import type {
  TransactionHistoryCollection,
  TransactionHistoryItem,
  TransactionHistoryNft,
  TransactionHistoryOperation,
  TransactionHistoryQuantity,
  TransactionHistoryStatus,
  TransactionHistoryToken,
  TransactionHistoryTransaction,
} from '@zerodev/wallet-data'
import type { TxHistoryEntry, TxHistoryStatus } from '../types'

/** `bare` is the title when there is no asset to name; it defaults to `verb`. */
const OPERATION: Record<
  TransactionHistoryOperation,
  { verb: string; bare?: string; icon: IconName }
> = {
  approve: { verb: 'Approved', icon: 'patchCheck' },
  bid: { verb: 'Bid on', bare: 'Placed bid', icon: 'tags' },
  burn: { verb: 'Burned', icon: 'flame' },
  claim: { verb: 'Claimed', icon: 'lighting' },
  delegate: { verb: 'Delegated', icon: 'user' },
  deploy: { verb: 'Deployed contract', icon: 'bezierCurve' },
  deposit: { verb: 'Deposited', icon: 'circleArrowDown' },
  execute: { verb: 'Executed', icon: 'transactionOutline' },
  mint: { verb: 'Minted', icon: 'stars' },
  receive: { verb: 'Received', icon: 'circleArrowDown' },
  revoke: { verb: 'Revoked', icon: 'x' },
  revoke_delegation: { verb: 'Revoked delegation', icon: 'x' },
  send: { verb: 'Sent', icon: 'circleArrowUp' },
  swap: { verb: 'Swapped', icon: 'arrowSwapHorizontalOutline' },
  withdraw: { verb: 'Withdrew', icon: 'circleArrowUp' },
  other: { verb: 'Transaction', icon: 'transactionOutline' },
}

export function operationIcon(
  operation: TransactionHistoryOperation,
): IconName {
  return OPERATION[operation].icon
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

const compact = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 2,
})
const thousands = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })
const units = new Intl.NumberFormat('en-US', { maximumFractionDigits: 4 })
const fraction = new Intl.NumberFormat('en-US', {
  maximumSignificantDigits: 4,
})

/**
 * Amount text that stays short enough to keep its symbol on a row: compact
 * from a billion up ("123.46B"), two decimals from a thousand up, four below
 * that, four significant digits below one, and a floor for dust.
 */
export function formatQuantity(q: TransactionHistoryQuantity): string {
  const abs = Math.abs(q.float)
  if (abs === 0) return '0'
  if (abs < 0.000001) return '<0.000001'
  if (abs >= 1e9) return compact.format(q.float)
  if (abs >= 1000) return thousands.format(q.float)
  if (abs >= 1) return units.format(q.float)
  return fraction.format(q.float)
}

/** The symbol, else a placeholder. The contract address is shown on the
 * details page instead of standing in for a symbol. */
export function tokenUnit(token: TransactionHistoryToken): string {
  return token.symbol ?? 'Unknown token'
}

/** Up to three characters standing in for a missing image: the start of a
 * one-word label, the initials of a longer one. */
export function initials(label: string): string {
  const words = label.split(/\s+/).filter(Boolean)
  if (words.length <= 1) return label.slice(0, 3).toUpperCase()
  return words
    .slice(0, 3)
    .map((word) => word.charAt(0).toUpperCase())
    .join('')
}

export function formatAmount(
  quantity: TransactionHistoryQuantity,
  token: TransactionHistoryToken,
): string {
  return `${formatQuantity(quantity)} ${tokenUnit(token)}`
}

const MAX_UINT256 =
  '115792089237316195423570985008687907853269984665640564039457584007913129639935'

const ALLOWANCE_OPERATIONS: ReadonlySet<TransactionHistoryOperation> = new Set([
  'approve',
  'revoke',
])

/**
 * An allowance is a cap, not a transfer: the max uint reads as "Unlimited"
 * and zero, which is what a revoke carries, as the bare unit.
 */
export function formatAllowance(
  quantity: TransactionHistoryQuantity,
  token: TransactionHistoryToken,
): string {
  const unit = tokenUnit(token)
  if (quantity.int === MAX_UINT256) return `Unlimited ${unit}`
  if (quantity.float === 0) return unit
  return `${formatQuantity(quantity)} ${unit}`
}

const LONG_TOKEN_ID = 16

/**
 * `#<id>` for display. Ids derived from hashes run to 78 digits, so a long
 * one keeps its first and last digits and drops the middle, like a hash.
 */
export function formatTokenId(tokenId: string): string {
  if (tokenId.length <= LONG_TOKEN_ID) return `#${tokenId}`
  return `#${tokenId.slice(0, 8)}…${tokenId.slice(-6)}`
}

/** One side of a transaction: what left the wallet, or what came in. */
export type AssetSide =
  | {
      kind: 'token'
      token: TransactionHistoryToken
      quantity: TransactionHistoryQuantity | undefined
    }
  | {
      kind: 'nft'
      nft: TransactionHistoryNft
      quantity: TransactionHistoryQuantity | undefined
    }
  | { kind: 'collection'; collection: TransactionHistoryCollection }

export interface AssetSides {
  from?: AssetSide
  /** Set on a two-sided swap or a paid mint. */
  to?: AssetSide
}

export function assetSides(tx: TransactionHistoryTransaction): AssetSides {
  const from: AssetSide | undefined = tx.nft
    ? { kind: 'nft', nft: tx.nft, quantity: tx.quantity }
    : tx.token
      ? { kind: 'token', token: tx.token, quantity: tx.quantity }
      : tx.collection
        ? { kind: 'collection', collection: tx.collection }
        : undefined
  const to: AssetSide | undefined = tx.destNft
    ? { kind: 'nft', nft: tx.destNft, quantity: tx.destQuantity }
    : tx.destToken
      ? { kind: 'token', token: tx.destToken, quantity: tx.destQuantity }
      : undefined
  return { ...(from && { from }), ...(to && { to }) }
}

/** The side a row and the details hero describe: what came in when there
 * was a counter-side, else the only side. */
export function headlineSide(sides: AssetSides): AssetSide | undefined {
  return sides.to ?? sides.from
}

export interface SideText {
  /** The row value and the hero headline. */
  text: string
  /** The token unit `text` ends with, kept visible when a row truncates. */
  unit?: string
  /** The hero's second line: the token id under a named NFT, even when the
   * name already carries it. The name is shown as the API sent it. */
  detail?: string
  /** Set only for a plain token amount with a known price. */
  usd?: number
  imageUri?: string
  /** Text standing in for the image when there is none. */
  fallback: string
}

/** Undefined when the side has nothing to show: a token without a quantity
 * or a collection without a name. */
export function describeSide(
  side: AssetSide,
  operation: TransactionHistoryOperation,
): SideText | undefined {
  switch (side.kind) {
    case 'nft': {
      const tokenId = formatTokenId(side.nft.tokenId)
      const count =
        side.quantity && side.quantity.float > 1
          ? ` ×${formatQuantity(side.quantity)}`
          : ''
      const name = side.nft.name ?? tokenId
      return {
        text: `${name}${count}`,
        ...(side.nft.name && { detail: tokenId }),
        ...(side.nft.imageUri && { imageUri: side.nft.imageUri }),
        fallback: initials(side.nft.name ?? 'NFT'),
      }
    }
    case 'collection':
      if (!side.collection.name) return undefined
      return {
        text: side.collection.name,
        ...(side.collection.imageUri && {
          imageUri: side.collection.imageUri,
        }),
        fallback: initials(side.collection.name),
      }
    case 'token': {
      if (!side.quantity) return undefined
      const image = side.token.imageUri && { imageUri: side.token.imageUri }
      const unit = tokenUnit(side.token)
      const fallback = initials(side.token.symbol ?? '?')
      if (ALLOWANCE_OPERATIONS.has(operation)) {
        return {
          text: formatAllowance(side.quantity, side.token),
          unit,
          ...image,
          fallback,
        }
      }
      return {
        text: formatAmount(side.quantity, side.token),
        unit,
        ...(side.token.priceUsd !== null && {
          usd: side.quantity.float * side.token.priceUsd,
        }),
        ...image,
        fallback,
      }
    }
  }
}

function sideLabel(side: AssetSide): string | undefined {
  switch (side.kind) {
    case 'nft':
      return 'NFT'
    case 'collection':
      return 'collection'
    case 'token':
      return side.token.symbol
  }
}

/** "Sent USDC", "Swapped NFT → WETH", "Deployed contract": the verb and the
 * asset the row and the details page headline with. */
export function transactionTitle(tx: TransactionHistoryTransaction): string {
  return title(tx, assetSides(tx))
}

function title(tx: TransactionHistoryTransaction, sides: AssetSides): string {
  const { verb } = OPERATION[tx.operation]
  const from = sides.from && sideLabel(sides.from)
  const to = sides.to && sideLabel(sides.to)
  if (tx.operation === 'swap' && from && to) return `${verb} ${from} → ${to}`
  const label = to ?? from
  return label ? `${verb} ${label}` : (OPERATION[tx.operation].bare ?? verb)
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
  const sides = assetSides(item)
  const headline = headlineSide(sides)
  const described = headline && describeSide(headline, item.operation)
  return {
    id: item.id,
    icon:
      headline?.kind === 'nft' ? 'imageFill' : OPERATION[item.operation].icon,
    title: title(item, sides),
    ...(described && { value: described.text }),
    ...(described?.unit && { unit: described.unit }),
    ...(described?.imageUri && { imageUri: described.imageUri }),
    chain: item.chain,
    status: TX_HISTORY_STATUS[item.status],
    timestampMs: item.timestamp * 1000,
    transaction: item,
  }
}
