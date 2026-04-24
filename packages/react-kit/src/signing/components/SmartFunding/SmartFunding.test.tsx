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

import { SmartFunding, type SmartFundingProps } from './index'

afterEach(() => {
  cleanup()
})

const pooledTokens: SmartFundingProps['pooledTokens'] = [
  {
    token: { symbol: 'ETH', network: 'ethereum' },
    pooledAmount: '0.3',
    availableAmount: '1.0',
  },
  {
    token: { symbol: 'ETH', network: 'arbitrum' },
    pooledAmount: '0.2',
    availableAmount: '0.5',
  },
]

describe('SmartFunding', () => {
  describe('header', () => {
    it('renders the title and stars icon', () => {
      render(
        <SmartFunding
          inputTokenSymbol="ETH"
          pooledTokens={pooledTokens}
          totalPooledAmount="0.5"
        />,
      )
      expect(screen.getByText('Smart Funding')).toBeDefined()
      expect(screen.getByTestId('icon-stars')).toBeDefined()
    })

    it('renders the toggle and an edit button', () => {
      render(
        <SmartFunding
          inputTokenSymbol="ETH"
          pooledTokens={pooledTokens}
          totalPooledAmount="0.5"
        />,
      )
      expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe(
        'true',
      )
      expect(screen.getByTestId('icon-edit')).toBeDefined()
    })
  })

  describe('pooled tokens', () => {
    it('renders a TokenCard per entry', () => {
      render(
        <SmartFunding
          inputTokenSymbol="ETH"
          pooledTokens={pooledTokens}
          totalPooledAmount="0.5"
        />,
      )
      expect(screen.getByText('Ethereum')).toBeDefined()
      expect(screen.getByText('Arbitrum')).toBeDefined()
    })

    it('renders nothing between the description and outcome when pooledTokens is empty', () => {
      render(
        <SmartFunding
          inputTokenSymbol="ETH"
          pooledTokens={[]}
          totalPooledAmount="0"
        />,
      )
      expect(screen.getByText('Pooling outcome')).toBeDefined()
    })
  })

  describe('pooling outcome', () => {
    it('shows the total pooled amount with the input token symbol', () => {
      render(
        <SmartFunding
          inputTokenSymbol="ETH"
          pooledTokens={pooledTokens}
          totalPooledAmount="0.5"
        />,
      )
      expect(screen.getByText('Pooling outcome')).toBeDefined()
      expect(screen.getByText('0.5 ETH')).toBeDefined()
    })
  })
})
