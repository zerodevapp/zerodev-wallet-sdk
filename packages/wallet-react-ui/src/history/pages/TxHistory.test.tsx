import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { DataApiError, useTransactionHistory } from '@zerodev/wallet-data'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sendTx, swapTx } from '../fixtures'
import { TxHistory } from '.'

vi.mock('@zerodev/wallet-data', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@zerodev/wallet-data')>()),
  useTransactionHistory: vi.fn(),
}))

type HistoryQuery = ReturnType<typeof useTransactionHistory>

interface QueryStub {
  status: HistoryQuery['status']
  data?: HistoryQuery['data']
  error?: Error
  hasNextPage?: boolean
  isFetchingNextPage?: boolean
  isFetchNextPageError?: boolean
  isRefetching?: boolean
  isRefetchError?: boolean
}

const refetch = vi.fn()
const fetchNextPage = vi.fn()
const refresh = vi.fn()
const waitForTransaction = vi.fn<HistoryQuery['waitForTransaction']>()

function mockQuery(query: QueryStub) {
  vi.mocked(useTransactionHistory).mockReturnValue({
    refetch,
    fetchNextPage,
    refresh,
    waitForTransaction,
    hasNextPage: false,
    isFetchingNextPage: false,
    isFetchNextPageError: false,
    isRefetching: false,
    isRefetchError: false,
    ...query,
  } as unknown as HistoryQuery)
}

function successQuery(overrides: Partial<QueryStub> = {}): QueryStub {
  return {
    status: 'success',
    data: { pages: [{ items: [sendTx, swapTx] }], pageParams: [null] },
    ...overrides,
  }
}

const dataApi = {
  baseUrl: 'https://data.example',
  environment: 'testnet',
} as const

beforeEach(() => {
  vi.clearAllMocks()
  waitForTransaction.mockReturnValue(new Promise(() => {}))
})

afterEach(cleanup)

describe('TxHistory', () => {
  it('passes the dataApi config to useTransactionHistory', () => {
    mockQuery({ status: 'pending' })
    render(<TxHistory dataApi={dataApi} onClose={() => {}} />)
    expect(useTransactionHistory).toHaveBeenCalledWith(dataApi)
  })

  it('shows skeletons while the query is pending', () => {
    mockQuery({ status: 'pending' })
    render(<TxHistory dataApi={dataApi} onClose={() => {}} />)
    expect(screen.getByLabelText('Loading transactions')).toBeDefined()
  })

  it('shows the error and retries through refetch', () => {
    mockQuery({ status: 'error', error: new Error('Network down') })
    render(<TxHistory dataApi={dataApi} onClose={() => {}} />)
    expect(screen.getByRole('alert').textContent).toContain(
      "Couldn't load transactions. Try again.",
    )
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(refetch).toHaveBeenCalledOnce()
  })

  it('renders the rows of every loaded page', () => {
    mockQuery(
      successQuery({
        data: {
          pages: [{ items: [sendTx], next: 'cursor' }, { items: [swapTx] }],
          pageParams: [null, 'cursor'],
        },
      }),
    )
    render(<TxHistory dataApi={dataApi} onClose={() => {}} />)
    expect(screen.getByText('Sent USDC')).toBeDefined()
    expect(screen.getByText('Swapped ETH → USDC')).toBeDefined()
  })

  it('shows the empty state for a successful empty response', () => {
    mockQuery(
      successQuery({
        data: { pages: [{ items: [] }], pageParams: [null] },
      }),
    )
    render(<TxHistory dataApi={dataApi} onClose={() => {}} />)
    expect(screen.getByText('No transactions yet')).toBeDefined()
  })

  it('loads the next page through fetchNextPage', () => {
    mockQuery(successQuery({ hasNextPage: true }))
    render(<TxHistory dataApi={dataApi} onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }))
    expect(fetchNextPage).toHaveBeenCalledOnce()
  })

  it('keeps the rows and shows the error inline when the next page fails', () => {
    mockQuery(
      successQuery({
        status: 'error',
        error: new Error('Next page failed'),
        isFetchNextPageError: true,
      }),
    )
    render(<TxHistory dataApi={dataApi} onClose={() => {}} />)
    expect(screen.getByText('Sent USDC')).toBeDefined()
    expect(screen.getByRole('alert').textContent).toBe(
      "Couldn't load transactions. Try again.",
    )
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }))
    expect(fetchNextPage).toHaveBeenCalledOnce()
    expect(refetch).not.toHaveBeenCalled()
  })

  it('refreshes through refresh, not refetch', () => {
    mockQuery(successQuery())
    render(<TxHistory dataApi={dataApi} onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    expect(refresh).toHaveBeenCalledOnce()
    expect(refetch).not.toHaveBeenCalled()
  })

  it('labels the list with the age of page 1 from cache.fetchedAt', () => {
    vi.useFakeTimers({ now: new Date('2026-11-18T12:00:00Z') })
    const fetchedAt = Date.parse('2026-11-18T11:58:00Z') / 1000
    mockQuery(
      successQuery({
        data: {
          pages: [{ items: [sendTx], cache: { fetchedAt } }],
          pageParams: [null],
        },
      }),
    )
    render(<TxHistory dataApi={dataApi} onClose={() => {}} />)
    expect(screen.getByText('Updated 2 min ago')).toBeDefined()
    vi.useRealTimers()
  })

  it('shows Updating… and disables Refresh while a refetch runs', () => {
    mockQuery(successQuery({ isRefetching: true }))
    render(<TxHistory dataApi={dataApi} onClose={() => {}} />)
    expect(screen.getByText('Updating…')).toBeDefined()
    const button = screen.getByRole('button', { name: 'Refresh' })
    expect((button as HTMLButtonElement).disabled).toBe(true)
  })

  it('keeps the rows and shows the error inline when a refresh fails', () => {
    mockQuery(
      successQuery({
        status: 'error',
        error: new Error('Refresh failed'),
        isRefetchError: true,
      }),
    )
    render(<TxHistory dataApi={dataApi} onClose={() => {}} />)
    expect(screen.getByText('Sent USDC')).toBeDefined()
    expect(screen.getByRole('alert').textContent).toBe(
      "Couldn't load transactions. Try again.",
    )
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(refresh).toHaveBeenCalledOnce()
  })

  it('disables Load more while the next page is fetching', () => {
    mockQuery(successQuery({ hasNextPage: true, isFetchingNextPage: true }))
    render(<TxHistory dataApi={dataApi} onClose={() => {}} />)
    const button = screen.getByRole('button', { name: 'Loading…' })
    expect((button as HTMLButtonElement).disabled).toBe(true)
  })

  it('titles the screen History and closes from the top nav', () => {
    const onClose = vi.fn()
    mockQuery({ status: 'pending' })
    render(<TxHistory dataApi={dataApi} onClose={onClose} />)
    expect(screen.getByText('History')).toBeDefined()
    fireEvent.click(screen.getByRole('button'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  describe('pendingTxHash', () => {
    const PENDING =
      '0x8f3a000000000000000000000000000000000000000000000000000000c41d'

    function renderPending(txHash: string | undefined) {
      return render(
        <TxHistory
          dataApi={dataApi}
          onClose={() => {}}
          {...(txHash && { pendingTxHash: txHash })}
        />,
      )
    }

    it('shows a placeholder and waits while the list lacks the hash', () => {
      mockQuery(successQuery())
      renderPending(PENDING)
      expect(screen.getByRole('status').textContent).toContain(
        'Waiting for transaction',
      )
      expect(screen.getByRole('status').textContent).toContain('0x8f3a...c41d')
      expect(waitForTransaction).toHaveBeenCalledWith(PENDING, {
        signal: expect.any(AbortSignal),
      })
    })

    it('says it is not in history yet once the wait gives up', async () => {
      waitForTransaction.mockResolvedValue(false)
      mockQuery(successQuery())
      renderPending(PENDING)
      await act(async () => {})
      expect(screen.getByRole('status').textContent).toContain(
        'Not in history yet',
      )
    })

    it('drops the placeholder and tints the row once the list has the hash', () => {
      mockQuery(successQuery())
      renderPending(sendTx.txHash.toUpperCase())
      expect(screen.queryByTestId('tx-history-pending')).toBeNull()
      const row = screen.getByText('Sent USDC').closest('.zd\\:p-2')
      expect(row?.className).toContain('zd:bg-brand-primary/10')
    })

    it('shows the placeholder instead of the empty state', () => {
      mockQuery(
        successQuery({ data: { pages: [{ items: [] }], pageParams: [null] } }),
      )
      renderPending(PENDING)
      expect(screen.getByTestId('tx-history-pending')).toBeDefined()
      expect(screen.queryByText('No transactions yet')).toBeNull()
    })

    it('drops the placeholder once the monthly budget is spent', () => {
      mockQuery(
        successQuery({
          status: 'error',
          isRefetchError: true,
          error: new DataApiError({
            status: 429,
            body: { error: 'throttled', reason: 'quota_exhausted' },
            url: 'x',
            retryAfterMs: 3_600_000,
          }),
        }),
      )
      renderPending(PENDING)
      expect(screen.queryByTestId('tx-history-pending')).toBeNull()
    })

    it('waits once per hash and aborts the old wait when the hash changes', () => {
      mockQuery(successQuery())
      const { rerender } = renderPending(PENDING)
      rerender(
        <TxHistory
          dataApi={dataApi}
          onClose={() => {}}
          pendingTxHash={PENDING}
        />,
      )
      expect(waitForTransaction).toHaveBeenCalledOnce()
      const first = waitForTransaction.mock.calls[0]?.[1]?.signal

      rerender(
        <TxHistory
          dataApi={dataApi}
          onClose={() => {}}
          pendingTxHash={sendTx.txHash}
        />,
      )
      expect(first?.aborted).toBe(true)
      expect(waitForTransaction).toHaveBeenCalledTimes(2)
    })

    it('does not wait without a hash', () => {
      mockQuery(successQuery())
      renderPending(undefined)
      expect(waitForTransaction).not.toHaveBeenCalled()
      expect(screen.queryByTestId('tx-history-pending')).toBeNull()
    })
  })
})
