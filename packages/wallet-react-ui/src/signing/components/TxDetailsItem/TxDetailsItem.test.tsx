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

import { TxDetailsItem, type TxDetailsItemProps } from './index'

afterEach(() => {
  cleanup()
})

const baseProps: TxDetailsItemProps = {
  title: 'Approve USDC',
  index: 1,
  data: {
    from: '0x1234...abcd',
    to: '0x5678...ef01',
    amount: '100 USDC',
  },
}

describe('TxDetailsItem', () => {
  describe('header', () => {
    it('renders the title and index', () => {
      render(<TxDetailsItem {...baseProps} />)
      expect(screen.getByText('Approve USDC')).toBeDefined()
      expect(screen.getByText('1')).toBeDefined()
    })

    it('shows a chevronDown icon when collapsed (default)', () => {
      render(<TxDetailsItem {...baseProps} />)
      expect(screen.getByTestId('icon-chevronDown')).toBeDefined()
    })
  })

  describe('expand/collapse', () => {
    it('hides data rows by default', () => {
      render(<TxDetailsItem {...baseProps} />)
      expect(screen.queryByText('From')).toBeNull()
      expect(screen.queryByText('To')).toBeNull()
      expect(screen.queryByText('Amount')).toBeNull()
    })

    it('shows data rows when toggled and switches the chevron icon', () => {
      render(<TxDetailsItem {...baseProps} />)
      fireEvent.click(screen.getByRole('button'))

      expect(screen.getByText('From')).toBeDefined()
      expect(screen.getByText('0x1234...abcd')).toBeDefined()
      expect(screen.getByText('To')).toBeDefined()
      expect(screen.getByText('Amount')).toBeDefined()
      expect(screen.getByTestId('icon-chevronUp')).toBeDefined()
    })

    it('hides data rows again on a second click', () => {
      render(<TxDetailsItem {...baseProps} />)
      const button = screen.getByRole('button')

      fireEvent.click(button)
      expect(screen.getByText('From')).toBeDefined()

      fireEvent.click(button)
      expect(screen.queryByText('From')).toBeNull()
      expect(screen.getByTestId('icon-chevronDown')).toBeDefined()
    })
  })

  describe('data rows', () => {
    it('renders a DataRow for each entry in data', () => {
      render(<TxDetailsItem {...baseProps} />)
      fireEvent.click(screen.getByRole('button'))

      expect(screen.getByText('0x1234...abcd')).toBeDefined()
      expect(screen.getByText('0x5678...ef01')).toBeDefined()
      expect(screen.getByText('100 USDC')).toBeDefined()
    })

    it('renders no data rows when data is empty', () => {
      render(<TxDetailsItem {...baseProps} data={{}} />)
      fireEvent.click(screen.getByRole('button'))

      expect(screen.queryByText('From')).toBeNull()
      expect(screen.queryByText('To')).toBeNull()
    })
  })
})
