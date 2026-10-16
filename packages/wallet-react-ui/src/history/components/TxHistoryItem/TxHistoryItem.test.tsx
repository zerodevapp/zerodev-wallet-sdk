import { cleanup, fireEvent, render, screen } from '@testing-library/react'
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

    it('keeps the unit in its own span so the amount truncates first', () => {
      render(
        <TxHistoryItem
          {...baseProps}
          value="0.000000000000000001 ETH"
          unit="ETH"
        />,
      )
      expect(screen.getByText('0.000000000000000001')).toBeDefined()
      expect(screen.getByText('ETH')).toBeDefined()
    })

    it('shows the asset image with the operation as a badge', () => {
      const { container } = render(
        <TxHistoryItem {...baseProps} imageUri="https://x/usdc.png" />,
      )
      expect(
        container.querySelector('img[src="https://x/usdc.png"]'),
      ).not.toBeNull()
      expect(
        screen.getByTestId('icon-arrowSwapHorizontalOutline'),
      ).toBeDefined()
    })

    it('falls back to the operation glyph when the image fails to load', () => {
      const { container } = render(
        <TxHistoryItem {...baseProps} imageUri="https://x/broken.png" />,
      )
      const img = container.querySelector('img[src="https://x/broken.png"]')
      fireEvent.error(img as Element)
      expect(container.querySelector('img')).toBeNull()
      expect(
        screen.getByTestId('icon-arrowSwapHorizontalOutline'),
      ).toBeDefined()
    })

    it('tints an incoming amount', () => {
      render(
        <TxHistoryItem {...baseProps} value="+5 USDC" unit="USDC" flow="in" />,
      )
      expect(screen.getByText('+5').parentElement?.className).toContain(
        'zd:text-positive',
      )
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
