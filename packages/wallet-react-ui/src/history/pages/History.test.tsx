import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { DataApiError } from '@zerodev/wallet-data'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { deployTx, sendTx, swapTx, unparsedWithTimestamp } from '../fixtures'
import type { HistoryFeed, TxHistoryEntry } from '../types'
import { toTxHistoryEntry } from '../utils/toTxHistoryEntry'
import { History } from './History'

afterEach(cleanup)

const entries = [sendTx, swapTx, deployTx, unparsedWithTimestamp].flatMap(
  (item) => toTxHistoryEntry(item) ?? [],
)

function ready(overrides: Partial<Extract<HistoryFeed, { status: 'ready' }>>) {
  return {
    status: 'ready',
    entries,
    hasMore: false,
    loadingMore: false,
    loadMore: () => {},
    ...overrides,
  } as const satisfies HistoryFeed
}

describe('History', () => {
  it('renders skeleton rows while loading', () => {
    render(<History feed={{ status: 'loading' }} />)
    expect(screen.getByLabelText('Loading transactions')).toBeDefined()
    expect(screen.getAllByTestId('tx-history-item-skeleton')).toHaveLength(4)
  })

  it('renders the error message with a retry button', () => {
    const retry = vi.fn()
    render(
      <History
        feed={{ status: 'error', error: new Error('Network down'), retry }}
      />,
    )
    expect(screen.getByRole('alert').textContent).toContain('Network down')
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(retry).toHaveBeenCalledOnce()
  })

  it('tells the user to sign in again on a 401', () => {
    const error = new DataApiError({ status: 401, body: null, url: 'x' })
    render(<History feed={{ status: 'error', error, retry: () => {} }} />)
    expect(
      screen.getByText('Your session expired. Sign in again.'),
    ).toBeDefined()
    expect(screen.queryByText(error.message)).toBeNull()
  })

  it('shows the raw message for other Data API errors', () => {
    const error = new DataApiError({ status: 500, body: null, url: 'x' })
    render(<History feed={{ status: 'error', error, retry: () => {} }} />)
    expect(screen.getByText(error.message)).toBeDefined()
  })

  it('renders the empty state when the feed has no entries', () => {
    render(<History feed={ready({ entries: [] })} />)
    expect(screen.getByText('No transactions yet')).toBeDefined()
  })

  it('renders every entry under a day header', () => {
    render(<History feed={ready({})} />)
    expect(screen.getByText('Sent USDC')).toBeDefined()
    expect(screen.getByText('Swapped ETH → USDC')).toBeDefined()
    expect(screen.getByText('Deployed contract')).toBeDefined()
    expect(screen.getByText('Unknown transaction')).toBeDefined()
    expect(screen.getAllByText('Ethereum Sepolia')).toHaveLength(4)
  })

  it('hides Load more when there are no more pages', () => {
    render(<History feed={ready({ hasMore: false })} />)
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull()
  })

  it('calls loadMore when Load more is clicked', () => {
    const loadMore = vi.fn()
    render(<History feed={ready({ hasMore: true, loadMore })} />)
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }))
    expect(loadMore).toHaveBeenCalledOnce()
  })

  it('disables the button while the next page loads', () => {
    render(<History feed={ready({ hasMore: true, loadingMore: true })} />)
    const button = screen.getByRole('button', { name: 'Loading…' })
    expect((button as HTMLButtonElement).disabled).toBe(true)
  })

  it('makes rows with a transaction selectable', () => {
    const onSelectEntry = vi.fn<(entry: TxHistoryEntry) => void>()
    render(<History feed={ready({})} onSelectEntry={onSelectEntry} />)
    fireEvent.click(screen.getByText('Sent USDC'))
    expect(onSelectEntry).toHaveBeenCalledWith(
      expect.objectContaining({ id: sendTx.id, transaction: sendTx }),
    )
  })

  it('keeps rows without a transaction out of the button set', () => {
    render(<History feed={ready({})} onSelectEntry={() => {}} />)
    expect(screen.getAllByRole('button')).toHaveLength(3)
    expect(screen.getByText('Unknown transaction').closest('button')).toBeNull()
  })

  it('renders no row buttons without onSelectEntry', () => {
    render(<History feed={ready({})} />)
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })
})
