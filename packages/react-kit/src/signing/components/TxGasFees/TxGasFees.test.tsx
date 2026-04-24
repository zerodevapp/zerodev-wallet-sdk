import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../shared/components/Icon', async () => {
  const React = await import('react')

  const MockIcon = ({
    name,
    ...props
  }: { name: string } & React.SVGProps<SVGSVGElement>) =>
    React.createElement('svg', { 'data-testid': `icon-${name}`, ...props })

  return {
    Icon: MockIcon,
    icons: {},
  }
})

import { type GasFee, TxGasFees, TxGasFeesSkeleton } from './index'

afterEach(() => {
  cleanup()
})

const gasFees: GasFee[] = [
  { tier: 'low', duration: 120, fee: '0.0001 ETH', feeUsd: '$0.30' },
  { tier: 'market', duration: 30, fee: '0.0005 ETH', feeUsd: '$1.50' },
  { tier: 'fast', duration: 10, fee: '0.001 ETH', feeUsd: '$3.00' },
]

describe('TxGasFees', () => {
  describe('rendering', () => {
    it('renders the header with the gas icon and title', () => {
      render(<TxGasFees selectedGasTier="market" gasFees={gasFees} />)
      expect(screen.getByText('Estimated Gas Fees')).toBeDefined()
      expect(screen.getAllByTestId('icon-lightingFill').length).toBeGreaterThan(
        0,
      )
    })

    it('renders the selected tier label inside the tier selector pill', () => {
      render(<TxGasFees selectedGasTier="fast" gasFees={gasFees} />)
      // 'Fast' appears twice: once in the selector pill, once in the ListItem
      expect(screen.getAllByText('Fast')).toHaveLength(2)
    })

    it('renders one row per gas tier', () => {
      render(<TxGasFees selectedGasTier="market" gasFees={gasFees} />)
      expect(screen.getByText('Low')).toBeDefined()
      expect(screen.getAllByText('Market').length).toBeGreaterThan(0)
      expect(screen.getByText('Fast')).toBeDefined()
    })

    it('renders fee and feeUsd as details for each tier', () => {
      render(<TxGasFees selectedGasTier="market" gasFees={gasFees} />)
      expect(screen.getByText('0.0001 ETH')).toBeDefined()
      expect(screen.getByText('$0.30')).toBeDefined()
      expect(screen.getByText('0.001 ETH')).toBeDefined()
      expect(screen.getByText('$3.00')).toBeDefined()
    })
  })

  describe('tier icons', () => {
    it('uses the hourglass icon for the low tier', () => {
      render(
        <TxGasFees
          selectedGasTier="low"
          gasFees={[{ tier: 'low', duration: 0, fee: 'x' }]}
        />,
      )
      expect(screen.getByTestId('icon-hourglass')).toBeDefined()
    })

    it('uses the rocket icon for the market tier', () => {
      render(
        <TxGasFees
          selectedGasTier="market"
          gasFees={[{ tier: 'market', duration: 0, fee: 'x' }]}
        />,
      )
      expect(screen.getByTestId('icon-rocket')).toBeDefined()
    })

    it('uses the lightingFill icon for the fast tier (in addition to header)', () => {
      render(
        <TxGasFees
          selectedGasTier="fast"
          gasFees={[{ tier: 'fast', duration: 0, fee: 'x' }]}
        />,
      )
      // one for header, one for the fast tier row
      expect(screen.getAllByTestId('icon-lightingFill')).toHaveLength(2)
    })
  })

  describe('selected tier display', () => {
    it('shows the selected tier fee and feeUsd in the Fee DataRow', () => {
      render(<TxGasFees selectedGasTier="market" gasFees={gasFees} />)
      expect(screen.getByText('0.0005 ETH ($1.50)')).toBeDefined()
    })
  })

  describe('slippage', () => {
    it('renders a Slippage row when slippage is provided', () => {
      render(
        <TxGasFees selectedGasTier="market" gasFees={gasFees} slippage={0.5} />,
      )
      expect(screen.getByText('Slippage')).toBeDefined()
      expect(screen.getByText('0.5%')).toBeDefined()
    })

    it('renders Slippage when slippage is 0 (falsy but defined)', () => {
      render(
        <TxGasFees selectedGasTier="market" gasFees={gasFees} slippage={0} />,
      )
      expect(screen.getByText('Slippage')).toBeDefined()
      expect(screen.getByText('0%')).toBeDefined()
    })

    it('omits the Slippage row when slippage is undefined', () => {
      render(<TxGasFees selectedGasTier="market" gasFees={gasFees} />)
      expect(screen.queryByText('Slippage')).toBeNull()
    })
  })
})

describe('TxGasFeesSkeleton', () => {
  it('renders the header', () => {
    render(<TxGasFeesSkeleton />)
    expect(screen.getByText('Estimated Gas Fees')).toBeDefined()
  })

  it('renders three ListItem skeletons', () => {
    const { container } = render(<TxGasFeesSkeleton />)
    const pulses = container.querySelectorAll('.animate-pulse')
    // 2 bars per ListItemSkeleton * 3 rows + avatar circle per row + 2 inline Fee bars
    expect(pulses.length).toBeGreaterThanOrEqual(3)
  })
})
