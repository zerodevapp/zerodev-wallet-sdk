import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../Icon', async () => {
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

import { Badge } from './index'

afterEach(() => {
  cleanup()
})

describe('Badge', () => {
  describe('rendering', () => {
    it('renders with text', () => {
      render(<Badge text="New" />)
      expect(screen.getByText('New')).toBeDefined()
    })

    it('renders with primary variant by default', () => {
      const { container } = render(<Badge text="Default" />)
      const badge = container.firstChild as HTMLElement
      expect(badge.className).toContain('bg-white/40')
    })

    it('renders with secondary variant', () => {
      const { container } = render(
        <Badge text="Secondary" variant="secondary" />,
      )
      const badge = container.firstChild as HTMLElement
      expect(badge.className).toContain('bg-orange/10')
    })
  })

  describe('icons', () => {
    it('renders leading icon when provided', () => {
      render(<Badge text="Badge" leadingIcon="check" />)
      expect(screen.getByTestId('icon-check')).toBeDefined()
      expect(screen.getByText('Badge')).toBeDefined()
    })

    it('renders trailing icon when provided', () => {
      render(<Badge text="Badge" trailingIcon="chevronRight" />)
      expect(screen.getByTestId('icon-chevronRight')).toBeDefined()
      expect(screen.getByText('Badge')).toBeDefined()
    })

    it('renders both leading and trailing icons', () => {
      render(
        <Badge text="Badge" leadingIcon="check" trailingIcon="chevronRight" />,
      )
      expect(screen.getByTestId('icon-check')).toBeDefined()
      expect(screen.getByTestId('icon-chevronRight')).toBeDefined()
      expect(screen.getByText('Badge')).toBeDefined()
    })

    it('renders without icons when not provided', () => {
      render(<Badge text="Badge" />)
      expect(screen.queryByTestId(/^icon-/)).toBeNull()
    })

    it('applies correct classes to leading icon', () => {
      render(<Badge text="Badge" leadingIcon="check" />)
      const icon = screen.getByTestId('icon-check')
      expect(icon.className).toContain('w-3')
      expect(icon.className).toContain('h-3')
      expect(icon.className).toContain('text-solarOrange')
    })

    it('applies correct classes to trailing icon', () => {
      render(<Badge text="Badge" trailingIcon="chevronRight" />)
      const icon = screen.getByTestId('icon-chevronRight')
      expect(icon.className).toContain('w-2.5')
      expect(icon.className).toContain('h-2.5')
    })
  })

  describe('className merging', () => {
    it('merges custom className with base classes', () => {
      const { container } = render(
        <Badge text="Custom" className="my-custom-class" />,
      )
      const badge = container.firstChild as HTMLElement
      expect(badge.className).toContain('my-custom-class')
      expect(badge.className).toContain('rounded-lg')
    })
  })

  describe('variants', () => {
    it('applies primary variant styles', () => {
      const { container } = render(<Badge text="Primary" variant="primary" />)
      const badge = container.firstChild as HTMLElement
      expect(badge.className).toContain('bg-white/40')
    })

    it('applies secondary variant styles', () => {
      const { container } = render(
        <Badge text="Secondary" variant="secondary" />,
      )
      const badge = container.firstChild as HTMLElement
      expect(badge.className).toContain('bg-orange/10')
    })
  })
})
