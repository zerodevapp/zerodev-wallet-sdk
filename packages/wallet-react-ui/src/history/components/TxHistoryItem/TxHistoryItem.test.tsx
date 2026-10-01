import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

// The real Icon resolves svgs through a vite `?react` glob that the root
// vitest run doesn't transform (icons render null there), so icon presence
// can't be asserted on real output. Substitute a queryable stub — same
// approach as react-ui's own Icon.test.tsx.
vi.mock('@zerodev/react-ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@zerodev/react-ui')>()
  const React = await import('react')
  return {
    ...actual,
    Icon: ({ name, ...props }: { name: string }) =>
      React.createElement('svg', { 'data-testid': `icon-${name}`, ...props }),
  }
})

import { TxHistoryItem, TxHistoryItemSkeleton } from './index'

afterEach(() => {
  cleanup()
})

const baseProps = {
  icon: 'arrowSwapHorizontalOutline',
  title: 'Swapped ETH → USDC',
  value: '2,343 USDC',
  chain: { name: 'Arbitrum' },
  status: 'Pending',
} as const

describe('TxHistoryItem', () => {
  describe('rendering', () => {
    it('renders title, value, chain and status', () => {
      render(<TxHistoryItem {...baseProps} />)
      expect(screen.getByText('Swapped ETH → USDC')).toBeDefined()
      expect(screen.getByText('2,343 USDC')).toBeDefined()
      expect(screen.getByText('Arbitrum')).toBeDefined()
      expect(screen.getByText('Pending')).toBeDefined()
      expect(
        screen.getByTestId('icon-arrowSwapHorizontalOutline'),
      ).toBeDefined()
    })

    it('renders the chain icon when the chain has one', () => {
      const { container } = render(
        <TxHistoryItem
          {...baseProps}
          chain={{ name: 'Arbitrum', iconUri: 'https://x/arb.png' }}
        />,
      )
      const img = container.querySelector('img[src="https://x/arb.png"]')
      expect(img).not.toBeNull()
    })

    it('renders no img element without a chain icon', () => {
      const { container } = render(<TxHistoryItem {...baseProps} />)
      expect(container.querySelector('img')).toBeNull()
    })

    it('renders without a value', () => {
      const { value: _, ...withoutValue } = baseProps
      render(<TxHistoryItem {...withoutValue} />)
      expect(screen.getByText('Swapped ETH → USDC')).toBeDefined()
      expect(screen.queryByText('2,343 USDC')).toBeNull()
    })
  })

  describe('status color', () => {
    it.each([
      ['Pending', 'zd:text-solarOrange'],
      ['Success', 'zd:text-positive'],
      ['Failed', 'zd:text-negative'],
      ['Unknown', 'zd:text-greyScale/50'],
    ] as const)('%s uses %s', (status, className) => {
      render(<TxHistoryItem {...baseProps} status={status} />)
      const el = screen.getByText(status)
      expect(el.className).toContain(className)
    })
  })
})

describe('TxHistoryItemSkeleton', () => {
  it('renders placeholder blocks and no text', () => {
    render(<TxHistoryItemSkeleton />)
    const skeleton = screen.getByTestId('tx-history-item-skeleton')
    expect(skeleton.textContent).toBe('')
  })
})
