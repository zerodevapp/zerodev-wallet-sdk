import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@zerodev/react-ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@zerodev/react-ui')>()
  const React = await import('react')

  const MockIcon = ({
    name,
    ...props
  }: { name: string } & React.SVGProps<SVGSVGElement>) =>
    React.createElement('svg', { 'data-testid': `icon-${name}`, ...props })

  return {
    ...actual,
    Icon: MockIcon,
    icons: {},
  }
})

import { AllocationModule, type AllocationModuleProps } from './index'

afterEach(() => {
  cleanup()
})

const baseProps: AllocationModuleProps = {
  token: {
    symbol: 'ETH',
    network: 'ethereum',
    imageSource: 'https://example.com/eth.png',
  },
  availableAmount: 1.5,
  checked: true,
  onCheck: () => {},
}

describe('AllocationModule', () => {
  describe('token info', () => {
    it('renders the token symbol and capitalized network', () => {
      render(<AllocationModule {...baseProps} />)
      expect(screen.getByText('ETH')).toBeDefined()
      expect(screen.getByText('Ethereum')).toBeDefined()
    })

    it('renders the network icon', () => {
      render(<AllocationModule {...baseProps} />)
      expect(screen.getByTestId('icon-ethereum')).toBeDefined()
    })

    it('renders the token image when imageSource is provided', () => {
      const { container } = render(<AllocationModule {...baseProps} />)
      const img = container.querySelector('img')
      expect(img?.getAttribute('src')).toBe('https://example.com/eth.png')
    })

    it('omits the token image when imageSource is missing', () => {
      const { container } = render(
        <AllocationModule
          {...baseProps}
          token={{ symbol: 'ETH', network: 'ethereum' }}
        />,
      )
      expect(container.querySelector('img')).toBeNull()
    })
  })

  describe('checkbox', () => {
    it('renders the available amount with the symbol as the label', () => {
      render(<AllocationModule {...baseProps} />)
      expect(screen.getByText('1.5 ETH')).toBeDefined()
    })

    it('reflects the checked prop', () => {
      render(<AllocationModule {...baseProps} checked={true} />)
      expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(
        true,
      )
    })

    it('reflects an unchecked state', () => {
      render(<AllocationModule {...baseProps} checked={false} />)
      expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(
        false,
      )
    })

    it('calls onCheck when the checkbox is toggled', () => {
      const onCheck = vi.fn()
      render(<AllocationModule {...baseProps} onCheck={onCheck} />)
      fireEvent.click(screen.getByRole('checkbox'))
      expect(onCheck).toHaveBeenCalledTimes(1)
    })
  })

  describe('amount input', () => {
    it('renders the input with the "0" placeholder', () => {
      render(<AllocationModule {...baseProps} />)
      expect(screen.getByPlaceholderText('0')).toBeDefined()
    })

    it('renders a Max button next to the input', () => {
      render(<AllocationModule {...baseProps} />)
      expect(screen.getByText('Max')).toBeDefined()
    })
  })
})
