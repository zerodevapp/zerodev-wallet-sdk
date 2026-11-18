import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { DataApiError } from '@zerodev/wallet-data'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { deployTx, sendTx, swapTx, unparsedWithTimestamp } from '../fixtures'
import type { HistoryFeed, TxHistoryEntry } from '../types'
import { toTxHistoryEntry } from '../utils/toTxHistoryEntry'
import { History } from './History'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

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
    refreshing: false,
    refresh: () => {},
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
    expect(screen.getByRole('alert').textContent).toContain(
      "Couldn't load transactions. Try again.",
    )
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
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
  })

  it('asks the user to wait on a 429', () => {
    const error = new DataApiError({ status: 429, body: null, url: 'x' })
    render(<History feed={{ status: 'error', error, retry: () => {} }} />)
    expect(
      screen.getByText('Too many requests. Try again in a moment.'),
    ).toBeDefined()
  })

  it('tells the user the monthly limit was reached without a retry button', () => {
    const error = new DataApiError({
      status: 429,
      body: { error: 'throttled', reason: 'quota_exhausted' },
      url: 'x',
      retryAfterMs: 3_600_000,
    })
    render(<History feed={{ status: 'error', error, retry: () => {} }} />)
    expect(screen.getByRole('alert').textContent).toContain(
      'Transaction history is unavailable until next month',
    )
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
  })

  it('never shows the raw message for other Data API errors', () => {
    const error = new DataApiError({ status: 500, body: null, url: 'x' })
    render(<History feed={{ status: 'error', error, retry: () => {} }} />)
    expect(screen.queryByText(error.message)).toBeNull()
    expect(
      screen.getByText("Couldn't load transactions. Try again."),
    ).toBeDefined()
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

  it('shows a load-more error above the button and keeps the rows', () => {
    const loadMore = vi.fn()
    const loadMoreError = new DataApiError({
      status: 401,
      body: null,
      url: 'x',
    })
    render(<History feed={ready({ hasMore: true, loadMore, loadMoreError })} />)
    expect(screen.getByText('Sent USDC')).toBeDefined()
    expect(screen.getByRole('alert').textContent).toBe(
      'Your session expired. Sign in again.',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }))
    expect(loadMore).toHaveBeenCalledOnce()
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
    const rows = screen
      .getAllByRole('button')
      .filter((button) => button.textContent !== 'Refresh')
    expect(rows).toHaveLength(3)
    expect(screen.getByText('Unknown transaction').closest('button')).toBeNull()
  })

  it('renders no row buttons without onSelectEntry', () => {
    render(<History feed={ready({})} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons.map((button) => button.textContent)).toEqual(['Refresh'])
  })

  describe('refresh', () => {
    it('shows no refresh line before the first page loads', () => {
      render(<History feed={{ status: 'loading' }} />)
      expect(screen.queryByRole('button', { name: 'Refresh' })).toBeNull()
    })

    it('offers Refresh on an empty list', () => {
      render(<History feed={ready({ entries: [] })} />)
      expect(screen.getByText('No transactions yet')).toBeDefined()
      expect(screen.getByRole('button', { name: 'Refresh' })).toBeDefined()
    })

    it('labels the age of the first page and ticks every 30 s', () => {
      vi.useFakeTimers({ now: new Date('2026-11-18T12:00:00Z') })
      const updatedAt = Date.parse('2026-11-18T11:59:10Z') / 1000
      render(<History feed={ready({ updatedAt })} />)
      expect(screen.getByText('Updated just now')).toBeDefined()
      act(() => vi.advanceTimersByTime(30_000))
      expect(screen.getByText('Updated 1 min ago')).toBeDefined()
    })

    it('shows no age without updatedAt', () => {
      render(<History feed={ready({})} />)
      expect(screen.queryByText(/^Updated/)).toBeNull()
      expect(screen.getByRole('button', { name: 'Refresh' })).toBeDefined()
    })

    it('locks Refresh for 10 s after a click', () => {
      vi.useFakeTimers()
      const refresh = vi.fn()
      render(<History feed={ready({ refresh })} />)
      const button = screen.getByRole('button', {
        name: 'Refresh',
      }) as HTMLButtonElement
      fireEvent.click(button)
      fireEvent.click(button)
      expect(refresh).toHaveBeenCalledOnce()
      expect(button.disabled).toBe(true)
      act(() => vi.advanceTimersByTime(9_999))
      expect(button.disabled).toBe(true)
      act(() => vi.advanceTimersByTime(1))
      expect(button.disabled).toBe(false)
    })

    it('shows Updating… and disables Refresh while refreshing', () => {
      render(<History feed={ready({ refreshing: true, updatedAt: 0 })} />)
      expect(screen.getByText('Updating…')).toBeDefined()
      const button = screen.getByRole('button', { name: 'Refresh' })
      expect((button as HTMLButtonElement).disabled).toBe(true)
    })

    it('keeps the rows and offers Retry when a refresh fails', () => {
      const refresh = vi.fn()
      const refreshError = new DataApiError({
        status: 429,
        body: null,
        url: 'x',
      })
      render(<History feed={ready({ refresh, refreshError })} />)
      expect(screen.getByText('Sent USDC')).toBeDefined()
      expect(screen.getByRole('alert').textContent).toBe(
        'Too many requests. Try again in a moment.',
      )
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
      expect(refresh).toHaveBeenCalledOnce()
    })

    it('hides the button after a 401, since only a new sign-in helps', () => {
      const refreshError = new DataApiError({
        status: 401,
        body: null,
        url: 'x',
      })
      render(<History feed={ready({ refreshError })} />)
      expect(screen.getByRole('alert').textContent).toBe(
        'Your session expired. Sign in again.',
      )
      expect(screen.queryByRole('button', { name: /Refresh|Retry/ })).toBeNull()
    })

    it('hides the button once the monthly budget is spent', () => {
      const refreshError = new DataApiError({
        status: 429,
        body: { error: 'throttled', reason: 'quota_exhausted' },
        url: 'x',
        retryAfterMs: 3_600_000,
      })
      render(<History feed={ready({ refreshError })} />)
      expect(screen.getByRole('alert').textContent).toContain(
        'unavailable until next month',
      )
      expect(screen.queryByRole('button', { name: /Refresh|Retry/ })).toBeNull()
      expect(screen.getByText('Sent USDC')).toBeDefined()
    })
  })
})
