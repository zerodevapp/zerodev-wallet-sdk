import { cleanup, render, screen } from '@testing-library/react'
import type { TransactionHistoryTransaction } from '@zerodev/wallet-data'
import {
  TRANSACTION_HISTORY_FIXTURE_IDS,
  TRANSACTION_HISTORY_FIXTURES,
  TRANSACTION_HISTORY_TRANSACTION_FIXTURE_IDS,
  TRANSACTION_HISTORY_TRANSACTION_FIXTURES,
  type TransactionHistoryTransactionFixtureId,
} from '@zerodev/wallet-data/fixtures'
import { afterEach, describe, expect, it } from 'vitest'
import { TransactionDetails } from '../pages/TransactionDetails'
import {
  TX_HISTORY_STATUS,
  tokenUnit,
  toTxHistoryEntry,
} from './toTxHistoryEntry'

afterEach(cleanup)

/** What the row must name: the incoming side when there is one, else the
 * only side. Mirrors the contract the Data API documents for its fields. */
function expectedAsset(tx: TransactionHistoryTransaction) {
  if (tx.destNft)
    return { label: 'NFT', value: tx.destNft.name ?? `#${tx.destNft.tokenId}` }
  if (tx.destToken && tx.destQuantity) {
    return { label: tx.destToken.symbol, value: tokenUnit(tx.destToken) }
  }
  if (tx.nft)
    return { label: 'NFT', value: tx.nft.name ?? `#${tx.nft.tokenId}` }
  if (tx.token) {
    return {
      label: tx.token.symbol,
      value: tx.quantity ? tokenUnit(tx.token) : undefined,
    }
  }
  if (tx.collection) return { label: 'collection', value: tx.collection.name }
  return { label: undefined, value: undefined }
}

describe('every contract fixture', () => {
  it.each(TRANSACTION_HISTORY_FIXTURE_IDS)('%s becomes a row', (id) => {
    const item = TRANSACTION_HISTORY_FIXTURES[id]
    const entry = toTxHistoryEntry(item)
    if ('kind' in item && item.timestamp === undefined) {
      expect(entry).toBeUndefined()
      return
    }
    expect(entry?.title).toBeTruthy()
    expect(entry?.chain.name).toBeTruthy()
  })

  it.each(TRANSACTION_HISTORY_TRANSACTION_FIXTURE_IDS)(
    '%s names its asset in the title and ends its value with the unit',
    (id) => {
      const tx = TRANSACTION_HISTORY_TRANSACTION_FIXTURES[id]
      const entry = toTxHistoryEntry(tx)
      const { label, value } = expectedAsset(tx)
      if (label) expect(entry?.title).toContain(label)
      if (value) expect(entry?.value).toContain(value)
      else expect(entry && 'value' in entry).toBe(false)
      expect(entry?.status).toBe(TX_HISTORY_STATUS[tx.status])
    },
  )

  it.each(TRANSACTION_HISTORY_TRANSACTION_FIXTURE_IDS)(
    '%s renders its details page',
    (id) => {
      const tx = TRANSACTION_HISTORY_TRANSACTION_FIXTURES[id]
      const entry = toTxHistoryEntry(tx)
      render(<TransactionDetails transaction={tx} />)
      expect(screen.getAllByText(entry?.title ?? '')).not.toHaveLength(0)
      expect(
        screen.getAllByText(TX_HISTORY_STATUS[tx.status]),
      ).not.toHaveLength(0)
      expect(screen.getAllByText(tx.chain.name)).not.toHaveLength(0)
    },
  )
})

const ROWS: [TransactionHistoryTransactionFixtureId, string, string?][] = [
  ['send', 'Sent USDC', '5 USDC'],
  ['receiveClaim', 'Claimed ETH', '0.005585 ETH'],
  ['selfSend', 'Sent ETH', '0.00009375 ETH'],
  ['sendSponsored', 'Sent ETH', '0.001 ETH'],
  ['swapTwoSided', 'Swapped USDC → USDT0', '1.4999 USDT0'],
  ['swapOutOnly', 'Swapped USDT0', '1.4999 USDT0'],
  ['swapNftForToken', 'Swapped NFT → WETH', '0.027 WETH'],
  ['swapNftForNft', 'Swapped NFT → NFT', '#30019'],
  ['approveFungible', 'Approved USDC', '1.5 USDC'],
  ['approveUnlimited', 'Approved USDT0', 'Unlimited USDT0'],
  ['approveNft', 'Approved NFT', 'Polyhedra 2024'],
  ['approveCollection', 'Approved collection', 'Heroes of Valdir'],
  ['revoke', 'Revoked USDC', 'USDC'],
  ['mint', 'Minted NFT', 'Robinhood Chain: Jumper'],
  ['mintNftQuantity', 'Minted NFT', 'Bonfires NFT ×5'],
  ['mintNftForToken', 'Minted NFT', 'Lido Withdrawal NFT #138839'],
  ['depositTwoSided', 'Deposited ETH', '0.00973 ETH'],
  ['burn', 'Burned stBARD', '56.6196 stBARD'],
  ['nftReceiveNoName', 'Received NFT', '#1974'],
  ['deploy', 'Deployed contract'],
  ['executeNoAsset', 'Executed'],
  ['transferNoAssetInfo', 'Received'],
]

describe('rows for the recorded shapes', () => {
  it.each(ROWS)('%s reads "%s" / "%s"', (id, title, value) => {
    const entry = toTxHistoryEntry(TRANSACTION_HISTORY_TRANSACTION_FIXTURES[id])
    expect(entry?.title).toBe(title)
    expect(entry?.value).toBe(value)
  })
})
