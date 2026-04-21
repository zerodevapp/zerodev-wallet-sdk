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

import { DataRow } from './index'

afterEach(() => {
  cleanup()
})

describe('DataRow', () => {
  describe('rendering', () => {
    it('renders label and string value', () => {
      render(<DataRow label="amount" value="0.05 ETH" />)
      expect(screen.getByText('Amount')).toBeDefined()
      expect(screen.getByText('0.05 ETH')).toBeDefined()
    })

    it('renders ReactNode value as-is (no Text wrapping)', () => {
      render(
        <DataRow
          label="recipient"
          value={<span data-testid="custom-value">Alice</span>}
        />,
      )
      expect(screen.getByTestId('custom-value')).toBeDefined()
    })

    it('returns null when label is missing', () => {
      const { container } = render(<DataRow value="x" />)
      expect(container.firstChild).toBeNull()
    })

    it('returns null when label is an empty string', () => {
      const { container } = render(<DataRow label="" value="x" />)
      expect(container.firstChild).toBeNull()
    })
  })

  describe('label formatting', () => {
    it('converts camelCase labels to Title Case', () => {
      render(<DataRow label="gasFee" value="0.001" />)
      expect(screen.getByText('Gas Fee')).toBeDefined()
    })

    it('leaves already-capitalized labels untouched', () => {
      render(<DataRow label="From" value="0x1" />)
      expect(screen.getByText('From')).toBeDefined()
    })
  })

  describe('icons', () => {
    it('renders a leading icon before the value when leadingIconName is provided', () => {
      render(
        <DataRow label="amount" value="0.05 ETH" leadingIconName="flame" />,
      )
      expect(screen.getByTestId('icon-flame')).toBeDefined()
    })

    it('renders a trailing icon after the value when iconName is provided', () => {
      render(<DataRow label="amount" value="0.05 ETH" iconName="info" />)
      expect(screen.getByTestId('icon-info')).toBeDefined()
    })

    it('renders no icons by default', () => {
      const { container } = render(<DataRow label="amount" value="x" />)
      expect(container.querySelector('svg')).toBeNull()
    })
  })

  describe('className', () => {
    it('merges custom className onto the root element', () => {
      const { container } = render(
        <DataRow label="amount" value="x" className="mt-4" />,
      )
      const root = container.firstChild as HTMLElement
      expect(root.className).toContain('mt-4')
      expect(root.className).toContain('flex')
      expect(root.className).toContain('flex-row')
    })
  })
})
