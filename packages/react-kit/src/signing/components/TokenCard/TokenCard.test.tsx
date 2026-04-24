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

import { type Token, TokenCard } from './index'

afterEach(() => {
  cleanup()
})

const baseToken: Token = {
  symbol: 'ETH',
  network: 'ethereum',
  imageSource: 'https://example.com/eth.png',
}

describe('TokenCard', () => {
  describe('rendering', () => {
    it('renders the token symbol', () => {
      render(
        <TokenCard
          token={baseToken}
          pooledAmount="0.5"
          availableAmount="1.0"
        />,
      )
      // symbol appears twice: header + trailing "/ {available} {symbol}"
      expect(screen.getAllByText('ETH').length).toBeGreaterThan(0)
    })

    it('renders the network name title-cased', () => {
      render(
        <TokenCard
          token={baseToken}
          pooledAmount="0.5"
          availableAmount="1.0"
        />,
      )
      expect(screen.getByText('Ethereum')).toBeDefined()
    })

    it('renders the network icon using the network name', () => {
      render(
        <TokenCard
          token={baseToken}
          pooledAmount="0.5"
          availableAmount="1.0"
        />,
      )
      expect(screen.getByTestId('icon-ethereum')).toBeDefined()
    })

    it('renders the token image when imageSource is provided', () => {
      const { container } = render(
        <TokenCard
          token={baseToken}
          pooledAmount="0.5"
          availableAmount="1.0"
        />,
      )
      const img = container.querySelector('img') as HTMLImageElement
      expect(img).not.toBeNull()
      expect(img.src).toBe('https://example.com/eth.png')
    })

    it('does not render an <img> when imageSource is missing', () => {
      const { container } = render(
        <TokenCard
          token={{ symbol: 'ETH', network: 'ethereum' }}
          pooledAmount="0.5"
          availableAmount="1.0"
        />,
      )
      expect(container.querySelector('img')).toBeNull()
    })
  })

  describe('amounts', () => {
    it('shows pooled and available amounts with the symbol', () => {
      const { container } = render(
        <TokenCard
          token={baseToken}
          pooledAmount="0.5"
          availableAmount="1.0"
        />,
      )
      expect(container.textContent).toContain('0.5')
      expect(container.textContent).toContain('/ 1.0 ETH')
    })
  })
})
