import { cleanup, fireEvent, render, screen } from '@testing-library/react'
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

import {
  SmartFundingGasDetails,
  type SmartFundingGasDetailsProps,
} from './index'

afterEach(() => {
  cleanup()
})

const bridgeRoutes = [
  { source: 'ethereum', destination: 'arbitrum', gasFee: '$0.12' },
  { source: 'ethereum', destination: 'optimism', gasFee: '$0.08' },
]

const swappedRoutes = [
  { source: 'arbitrum', destination: 'base', gasFee: '$0.05' },
]

const baseProps: SmartFundingGasDetailsProps = {
  executionTime: 45,
  slippage: 0.5,
  gasRoutes: {
    bridge: bridgeRoutes,
    swapped: swappedRoutes,
  },
  providerFees: [
    { provider: 'ZeroDev', percentage: 0.1, fee: '$0.10' },
    { provider: 'LI.FI', percentage: 0.2, fee: '$0.20' },
  ],
  bridgeAmount: '0.3 ETH',
  swapAmount: '0.2 ETH',
}

describe('SmartFundingGasDetails', () => {
  describe('header', () => {
    it('renders the title and stars icon', () => {
      render(<SmartFundingGasDetails {...baseProps} />)
      expect(screen.getByText('Smart Funding Gas Details')).toBeDefined()
      expect(screen.getByTestId('icon-stars')).toBeDefined()
    })

    it('shows a chevronUp icon when expanded (default)', () => {
      render(<SmartFundingGasDetails {...baseProps} />)
      expect(screen.getByTestId('icon-chevronUp')).toBeDefined()
    })

    it('toggles content visibility when the chevron button is clicked', () => {
      render(<SmartFundingGasDetails {...baseProps} />)
      expect(screen.getByText('Total execution time')).toBeDefined()

      fireEvent.click(screen.getByRole('button'))

      expect(screen.queryByText('Total execution time')).toBeNull()
      expect(screen.getByTestId('icon-chevronDown')).toBeDefined()

      fireEvent.click(screen.getByRole('button'))
      expect(screen.getByText('Total execution time')).toBeDefined()
    })
  })

  describe('summary rows', () => {
    it('renders execution time with ≈ prefix and sec suffix', () => {
      render(<SmartFundingGasDetails {...baseProps} />)
      expect(screen.getByText('≈ 45 sec')).toBeDefined()
    })

    it('renders slippage as a percentage', () => {
      render(<SmartFundingGasDetails {...baseProps} />)
      expect(screen.getByText('0.5%')).toBeDefined()
    })
  })

  describe('bridge routes', () => {
    it('renders the bridge section header with the route count', () => {
      render(<SmartFundingGasDetails {...baseProps} />)
      expect(screen.getByText('2 Bridge')).toBeDefined()
    })

    it('renders a RouteItem per bridge entry', () => {
      render(<SmartFundingGasDetails {...baseProps} />)
      expect(screen.getByText('Arbitrum')).toBeDefined()
      expect(screen.getByText('Optimism')).toBeDefined()
    })

    it('hides the bridge section when no bridge routes are provided', () => {
      render(
        <SmartFundingGasDetails
          {...baseProps}
          gasRoutes={{ swapped: swappedRoutes }}
        />,
      )
      expect(screen.queryByText(/Bridge/)).toBeNull()
    })

    it('hides the bridge section when bridge routes is an empty array', () => {
      render(
        <SmartFundingGasDetails
          {...baseProps}
          gasRoutes={{ bridge: [], swapped: swappedRoutes }}
        />,
      )
      expect(screen.queryByText(/Bridge/)).toBeNull()
    })
  })

  describe('swapped routes', () => {
    it('renders the swapped section header with the route count', () => {
      render(<SmartFundingGasDetails {...baseProps} />)
      expect(screen.getByText('1 Swapped')).toBeDefined()
    })

    it('hides the swapped section when no swapped routes are provided', () => {
      render(
        <SmartFundingGasDetails
          {...baseProps}
          gasRoutes={{ bridge: bridgeRoutes }}
        />,
      )
      expect(screen.queryByText(/Swapped/)).toBeNull()
    })
  })

  describe('provider fees', () => {
    it('renders a DataRow for each provider fee with percentage in the label', () => {
      render(<SmartFundingGasDetails {...baseProps} />)
      expect(screen.getByText('ZeroDev Fee (0.1%)')).toBeDefined()
      expect(screen.getByText('LI.FI Fee (0.2%)')).toBeDefined()
      expect(screen.getByText('$0.10')).toBeDefined()
      expect(screen.getByText('$0.20')).toBeDefined()
    })
  })

  describe('summary alert', () => {
    it('shows a summary description with bridge and swap amounts', () => {
      render(<SmartFundingGasDetails {...baseProps} />)
      expect(screen.getByText('Summary')).toBeDefined()
      expect(
        screen.getByText(
          'You are bridging 0.3 ETH and you are swapping for an equivalent of 0.2 ETH',
        ),
      ).toBeDefined()
    })
  })
})
