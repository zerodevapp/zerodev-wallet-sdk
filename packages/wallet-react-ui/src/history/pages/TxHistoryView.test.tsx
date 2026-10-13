import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { TransactionHistoryTransaction } from '@zerodev/wallet-data'
import { afterEach, describe, expect, it } from 'vitest'
import { pendingTx, sendTx, swapTx } from '../fixtures'
import type { HistoryFeed } from '../types'
import { toTxHistoryEntry } from '../utils/toTxHistoryEntry'
import { TxHistoryView } from './TxHistoryView'

afterEach(cleanup)

function ready(items: TransactionHistoryTransaction[]): HistoryFeed {
  return {
    status: 'ready',
    entries: items.flatMap((item) => toTxHistoryEntry(item) ?? []),
    hasMore: false,
    loadingMore: false,
    loadMore: () => {},
  }
}

describe('TxHistoryView', () => {
  it('opens the details of a selected row with a back chevron', () => {
    render(<TxHistoryView feed={ready([sendTx, swapTx])} onClose={() => {}} />)
    fireEvent.click(screen.getByText('Sent USDC'))
    expect(screen.getAllByText('Transaction details')).toHaveLength(2)
    expect(screen.queryByText('Swapped ETH → USDC')).toBeNull()
    expect(screen.getAllByRole('button')).toHaveLength(2)
  })

  it('returns to the list from the back chevron', () => {
    render(<TxHistoryView feed={ready([sendTx, swapTx])} onClose={() => {}} />)
    fireEvent.click(screen.getByText('Sent USDC'))
    const [back] = screen.getAllByRole('button')
    fireEvent.click(back as HTMLElement)
    expect(screen.getByText('History')).toBeDefined()
    expect(screen.getByText('Swapped ETH → USDC')).toBeDefined()
  })

  it('updates open details when the feed confirms the transaction', () => {
    const { rerender } = render(
      <TxHistoryView feed={ready([pendingTx])} onClose={() => {}} />,
    )
    fireEvent.click(screen.getByText('Sent ETH'))
    expect(screen.getByText('Confirming on Ethereum Sepolia')).toBeDefined()

    rerender(
      <TxHistoryView
        feed={ready([{ ...pendingTx, status: 'success' }])}
        onClose={() => {}}
      />,
    )
    expect(screen.getByText('Confirmed on Ethereum Sepolia')).toBeDefined()
  })
})
