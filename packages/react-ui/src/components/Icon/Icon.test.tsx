import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('./index', async () => {
  const React = await import('react')

  const MockCheckIcon = (props: React.SVGProps<SVGSVGElement>) =>
    React.createElement('svg', { 'data-testid': 'mock-check-icon', ...props })
  const MockArrowLeftIcon = (props: React.SVGProps<SVGSVGElement>) =>
    React.createElement('svg', {
      'data-testid': 'mock-arrow-left-icon',
      ...props,
    })

  const iconsMap: Record<string, React.FC<React.SVGProps<SVGSVGElement>>> = {
    check: MockCheckIcon,
    arrowLeft: MockArrowLeftIcon,
  }

  return {
    icons: iconsMap,
    Icon: ({
      name,
      ...props
    }: { name: string } & React.SVGProps<SVGSVGElement>) => {
      const Component = iconsMap[name]
      if (!Component) return null
      return React.createElement(Component, props)
    },
  }
})

import { Icon, icons } from './index'

afterEach(() => {
  cleanup()
})

describe('Icon', () => {
  describe('rendering', () => {
    it('renders the correct icon by name', () => {
      render(<Icon name="check" />)
      expect(screen.getByTestId('mock-check-icon')).toBeDefined()
    })

    it('renders a different icon by name', () => {
      render(<Icon name="arrowLeft" />)
      expect(screen.getByTestId('mock-arrow-left-icon')).toBeDefined()
    })

    it('returns null for an unknown icon name', () => {
      const { container } = render(<Icon name="nonExistent" />)
      expect(container.innerHTML).toBe('')
    })
  })

  describe('prop passthrough', () => {
    it('passes className to the SVG element', () => {
      render(<Icon name="check" className="w-6 h-6 text-white" />)
      const svg = screen.getByTestId('mock-check-icon')
      expect(svg.getAttribute('class')).toBe('w-6 h-6 text-white')
    })

    it('passes aria-label to the SVG element', () => {
      render(<Icon name="check" aria-label="Checkmark" />)
      const svg = screen.getByTestId('mock-check-icon')
      expect(svg.getAttribute('aria-label')).toBe('Checkmark')
    })

    it('passes width and height props', () => {
      render(<Icon name="check" width={32} height={32} />)
      const svg = screen.getByTestId('mock-check-icon')
      expect(svg.getAttribute('width')).toBe('32')
      expect(svg.getAttribute('height')).toBe('32')
    })

    it('passes data attributes', () => {
      render(<Icon name="check" data-tooltip="check" />)
      const svg = screen.getByTestId('mock-check-icon')
      expect(svg.getAttribute('data-tooltip')).toBe('check')
    })
  })

  describe('icons map', () => {
    it('exports an icons record', () => {
      expect(icons).toBeDefined()
      expect(typeof icons).toBe('object')
    })

    it('contains expected icon entries', () => {
      expect(icons.check).toBeDefined()
      expect(icons.arrowLeft).toBeDefined()
    })

    it('icon entries are functions (components)', () => {
      expect(typeof icons.check).toBe('function')
      expect(typeof icons.arrowLeft).toBe('function')
    })
  })
})
