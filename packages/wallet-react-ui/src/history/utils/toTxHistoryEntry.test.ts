import type {
  TransactionHistoryOperation,
  TransactionHistoryStatus,
} from '@zerodev/wallet-data'
import { describe, expect, it } from 'vitest'
import {
  approveTx,
  deployTx,
  nftMintTx,
  quantity,
  receiveTx,
  sendTx,
  swapTx,
  unknownStatusTx,
  unparsedWithoutTimestamp,
  unparsedWithTimestamp,
} from '../fixtures'
import type { TxHistoryStatus } from '../types'
import { formatQuantity, toTxHistoryEntry } from './toTxHistoryEntry'

const OPERATIONS: Record<
  TransactionHistoryOperation,
  { title: string; icon: string }
> = {
  approve: { title: 'Approved', icon: 'patchCheck' },
  bid: { title: 'Bid on', icon: 'tags' },
  burn: { title: 'Burned', icon: 'flame' },
  claim: { title: 'Claimed', icon: 'lighting' },
  delegate: { title: 'Delegated', icon: 'user' },
  deploy: { title: 'Deployed contract', icon: 'bezierCurve' },
  deposit: { title: 'Deposited', icon: 'circleArrowDown' },
  execute: { title: 'Executed', icon: 'transaction' },
  mint: { title: 'Minted', icon: 'stars' },
  receive: { title: 'Received', icon: 'circleArrowDown' },
  revoke: { title: 'Revoked', icon: 'x' },
  revoke_delegation: { title: 'Revoked delegation', icon: 'x' },
  send: { title: 'Sent', icon: 'circleArrowUp' },
  swap: { title: 'Swapped', icon: 'arrowSwapHorizontalOutline' },
  withdraw: { title: 'Withdrew', icon: 'circleArrowUp' },
  other: { title: 'Transaction', icon: 'transaction' },
}

const STATUSES: Record<TransactionHistoryStatus, TxHistoryStatus> = {
  pending: 'Pending',
  success: 'Success',
  failed: 'Failed',
  unknown: 'Unknown',
}

describe('toTxHistoryEntry', () => {
  it.each(Object.entries(OPERATIONS))(
    '%s with no asset maps to its verb and icon',
    (operation, expected) => {
      const entry = toTxHistoryEntry({
        ...deployTx,
        operation: operation as TransactionHistoryOperation,
      })
      expect(entry?.title).toBe(expected.title)
      expect(entry?.icon).toBe(expected.icon)
      expect(entry && 'value' in entry).toBe(false)
    },
  )

  it.each(Object.entries(STATUSES))(
    'status %s maps to %s',
    (status, expected) => {
      const entry = toTxHistoryEntry({
        ...sendTx,
        status: status as TransactionHistoryStatus,
      })
      expect(entry?.status).toBe(expected)
    },
  )

  it('titles a token transfer with its symbol and values it by quantity', () => {
    expect(toTxHistoryEntry(sendTx)).toMatchObject({
      id: sendTx.id,
      icon: 'circleArrowUp',
      title: 'Sent USDC',
      value: '25 USDC',
      status: 'Success',
      timestamp: sendTx.timestamp * 1000,
      transaction: sendTx,
    })
    expect(toTxHistoryEntry(receiveTx)?.value).toBe('0.5 ETH')
  })

  it('passes the item chain through', () => {
    expect(toTxHistoryEntry(sendTx)?.chain).toBe(sendTx.chain)
  })

  it('titles a swap with both symbols and values it by the destination side', () => {
    const entry = toTxHistoryEntry(swapTx)
    expect(entry?.title).toBe('Swapped ETH → USDC')
    expect(entry?.value).toBe('2,498.12 USDC')
  })

  it('values a swap without a destination by its source side', () => {
    const { destToken: _t, destQuantity: _q, ...oneSided } = swapTx
    const entry = toTxHistoryEntry(oneSided)
    expect(entry?.title).toBe('Swapped ETH')
    expect(entry?.value).toBe('1 ETH')
  })

  it('renders an NFT with the image icon and its name as the value', () => {
    expect(toTxHistoryEntry(nftMintTx)).toMatchObject({
      icon: 'imageFill',
      title: 'Minted NFT',
      value: 'ZeroDev Pass',
    })
  })

  it('falls back to the token id for an unnamed NFT', () => {
    const entry = toTxHistoryEntry({ ...nftMintTx, nft: { tokenId: '42' } })
    expect(entry?.value).toBe('#42')
  })

  it('leaves value out when a token has no quantity', () => {
    const entry = toTxHistoryEntry(approveTx)
    expect(entry?.title).toBe('Approved USDC')
    expect(entry && 'value' in entry).toBe(false)
  })

  it('leaves value out for a deploy', () => {
    const entry = toTxHistoryEntry(deployTx)
    expect(entry?.title).toBe('Deployed contract')
    expect(entry && 'value' in entry).toBe(false)
  })

  it('keeps an unknown-status transaction selectable', () => {
    expect(toTxHistoryEntry(unknownStatusTx)).toMatchObject({
      status: 'Unknown',
      transaction: unknownStatusTx,
    })
  })

  it('maps an unparsed item with a timestamp to an inert row', () => {
    const entry = toTxHistoryEntry(unparsedWithTimestamp)
    expect(entry).toEqual({
      id: unparsedWithTimestamp.txHash,
      icon: 'question',
      title: 'Unknown transaction',
      chain: unparsedWithTimestamp.chain,
      status: 'Unknown',
      timestamp: (unparsedWithTimestamp.timestamp ?? 0) * 1000,
    })
  })

  it('names the network "Unknown network" for an unparsed item without a chain', () => {
    const { chain: _c, ...chainless } = unparsedWithTimestamp
    expect(toTxHistoryEntry(chainless)?.chain).toEqual({
      name: 'Unknown network',
    })
  })

  it('drops an unparsed item without a timestamp', () => {
    expect(toTxHistoryEntry(unparsedWithoutTimestamp)).toBeUndefined()
  })
})

describe('formatQuantity', () => {
  it('groups thousands and keeps six significant digits', () => {
    expect(formatQuantity(quantity(1234.56789, 6))).toBe('1,234.57')
    expect(formatQuantity(quantity(0.000123456789, 18))).toBe('0.000123457')
  })
})
