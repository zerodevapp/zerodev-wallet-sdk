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

import { TxHistoryItem } from './index'

afterEach(() => {
  cleanup()
})

const baseProps = {
  icon: 'arrowSwapHorizontalOutline',
  title: 'Swapped ETH → USD₮0',
  value: '2,343 ETH',
  chainName: 'Arbitrum One',
  status: 'Pending',
} as const

describe('TxHistoryItem', () => {
  describe('rendering', () => {
    it('renders title, value, chain and status', () => {
      render(<TxHistoryItem {...baseProps} />)
      expect(screen.getByText('Swapped ETH → USD₮0')).toBeDefined()
      expect(screen.getByText('2,343 ETH')).toBeDefined()
      expect(screen.getByText('Arbitrum One')).toBeDefined()
      expect(screen.getByText('Pending')).toBeDefined()
      expect(
        screen.getByTestId('icon-arrowSwapHorizontalOutline'),
      ).toBeDefined()
    })

    it('renders the chain icon when a URL is supplied', () => {
      const { container } = render(
        <TxHistoryItem {...baseProps} chainIconUrl="https://x/arb.png" />,
      )
      const img = container.querySelector('img[src="https://x/arb.png"]')
      expect(img).not.toBeNull()
    })

    it('renders no img element without icon URLs', () => {
      const { container } = render(<TxHistoryItem {...baseProps} />)
      expect(container.querySelector('img')).toBeNull()
    })
  })

  describe('destination chain', () => {
    it('renders the destination chain when provided', () => {
      render(<TxHistoryItem {...baseProps} destChainName="Base" />)
      expect(screen.getByText('Base')).toBeDefined()
    })

    it('omits the arrow separator for single-chain rows', () => {
      render(<TxHistoryItem {...baseProps} />)
      expect(screen.queryByTestId('icon-arrowRightFill')).toBeNull()
    })

    it('renders the arrow separator between the two chains', () => {
      render(<TxHistoryItem {...baseProps} destChainName="Base" />)
      expect(screen.getByTestId('icon-arrowRightFill')).toBeDefined()
    })
  })

  describe('status color', () => {
    it.each([
      ['Pending', 'zd:text-brand-primary'],
      ['Success', 'zd:text-success-primary'],
      ['Failed', 'zd:text-error-primary'],
    ] as const)('%s uses %s', (status, className) => {
      render(<TxHistoryItem {...baseProps} status={status} />)
      const el = screen.getByText(status)
      expect(el.className).toContain(className)
    })
  })
})
