import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useTransactionHistory } from '@zerodev/wallet-data'
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

function mockQuery(query: QueryStub) {
  vi.mocked(useTransactionHistory).mockReturnValue({
    refetch,
    fetchNextPage,
    refresh,
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
})
