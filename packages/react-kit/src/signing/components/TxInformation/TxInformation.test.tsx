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

import { type Dapp, TxInformation } from './index'

afterEach(() => {
  cleanup()
})

const baseDapp: Dapp = {
  name: 'Uniswap',
  domain: 'app.uniswap.org',
  network: 'ethereum',
  imageSource: 'https://example.com/logo.png',
}

describe('TxInformation', () => {
  describe('header', () => {
    it('renders the "Request from" label and dapp name', () => {
      render(<TxInformation dapp={baseDapp} />)
      expect(screen.getByText('Request from')).toBeDefined()
      expect(screen.getByText('Uniswap')).toBeDefined()
    })

    it('renders the dapp logo with the provided image source', () => {
      const { container } = render(<TxInformation dapp={baseDapp} />)
      const img = container.querySelector('img')
      expect(img).not.toBeNull()
      expect(img?.getAttribute('src')).toBe('https://example.com/logo.png')
    })
  })

  describe('domain', () => {
    it('renders the domain when provided', () => {
      render(<TxInformation dapp={baseDapp} />)
      expect(screen.getByText('Domain')).toBeDefined()
      expect(screen.getByText('app.uniswap.org')).toBeDefined()
    })

    it('falls back to "Unknown" when domain is undefined', () => {
      render(<TxInformation dapp={{ ...baseDapp, domain: undefined }} />)
      expect(screen.getByText('Unknown')).toBeDefined()
    })
  })

  describe('network', () => {
    it('renders the network row with capitalized name and matching icon', () => {
      render(<TxInformation dapp={baseDapp} />)
      expect(screen.getByText('Network')).toBeDefined()
      expect(screen.getByText('Ethereum')).toBeDefined()
      expect(screen.getByTestId('icon-ethereum')).toBeDefined()
    })

    it('omits the network row when network is undefined', () => {
      render(<TxInformation dapp={{ ...baseDapp, network: undefined }} />)
      expect(screen.queryByText('Network')).toBeNull()
    })
  })
})
