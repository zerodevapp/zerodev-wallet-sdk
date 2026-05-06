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

import { TxInformation } from './index'

afterEach(() => {
  cleanup()
})

describe('TxInformation', () => {
  describe('network', () => {
    it('renders the network row with capitalized name and matching icon', () => {
      render(<TxInformation network="ethereum" />)
      expect(screen.getByText('Network')).toBeDefined()
      expect(screen.getByText('Ethereum')).toBeDefined()
      expect(screen.getByTestId('icon-ethereum')).toBeDefined()
    })

    it('omits the network row when network is undefined', () => {
      render(<TxInformation network={undefined} />)
      expect(screen.queryByText('Network')).toBeNull()
    })

    it('omits the network row when network is omitted', () => {
      render(<TxInformation />)
      expect(screen.queryByText('Network')).toBeNull()
    })
  })
})
