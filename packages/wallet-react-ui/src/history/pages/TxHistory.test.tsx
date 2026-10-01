import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useTransactionHistory } from '@zerodev/wallet-data'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { pendingTx, sendTx, swapTx } from '../fixtures'
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
}

const refetch = vi.fn()
const fetchNextPage = vi.fn()

function mockQuery(query: QueryStub) {
  vi.mocked(useTransactionHistory).mockReturnValue({
    refetch,
    fetchNextPage,
    hasNextPage: false,
    isFetchingNextPage: false,
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
    expect(screen.getByRole('alert').textContent).toContain('Network down')
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

  it('opens the details of a selected row with a back chevron', () => {
    mockQuery(successQuery())
    render(<TxHistory dataApi={dataApi} onClose={() => {}} />)
    fireEvent.click(screen.getByText('Sent USDC'))
    expect(screen.getAllByText('Transaction details')).toHaveLength(2)
    expect(screen.queryByText('Swapped ETH → USDC')).toBeNull()
    expect(screen.getAllByRole('button')).toHaveLength(2)
  })

  it('returns to the list from the back chevron', () => {
    mockQuery(successQuery())
    render(<TxHistory dataApi={dataApi} onClose={() => {}} />)
    fireEvent.click(screen.getByText('Sent USDC'))
    const [back] = screen.getAllByRole('button')
    fireEvent.click(back as HTMLElement)
    expect(screen.getByText('History')).toBeDefined()
    expect(screen.getByText('Swapped ETH → USDC')).toBeDefined()
  })

  it('updates open details when a refetch confirms the transaction', () => {
    mockQuery(
      successQuery({
        data: { pages: [{ items: [pendingTx] }], pageParams: [null] },
      }),
    )
    const { rerender } = render(
      <TxHistory dataApi={dataApi} onClose={() => {}} />,
    )
    fireEvent.click(screen.getByText('Sent ETH'))
    expect(screen.getByText('Confirming on Ethereum Sepolia')).toBeDefined()

    mockQuery(
      successQuery({
        data: {
          pages: [{ items: [{ ...pendingTx, status: 'success' }] }],
          pageParams: [null],
        },
      }),
    )
    rerender(<TxHistory dataApi={dataApi} onClose={() => {}} />)
    expect(screen.getByText('Confirmed on Ethereum Sepolia')).toBeDefined()
  })
})
