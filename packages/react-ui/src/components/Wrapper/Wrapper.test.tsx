import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { Wrapper } from './index'

afterEach(() => {
  cleanup()
})

describe('Wrapper', () => {
  describe('rendering', () => {
    it('renders children', () => {
      render(<Wrapper>Hello World</Wrapper>)
      expect(screen.getByText('Hello World')).toBeDefined()
    })

    it('renders nested elements', () => {
      render(
        <Wrapper>
          <span data-testid="child">Nested</span>
        </Wrapper>,
      )
      expect(screen.getByTestId('child')).toBeDefined()
      expect(screen.getByText('Nested')).toBeDefined()
    })
  })

  describe('variant backgrounds', () => {
    it('applies the bright-tertiary surface for ghost', () => {
      const { container } = render(<Wrapper variant="ghost">Ghost</Wrapper>)
      const outer = container.firstChild as HTMLElement
      expect(outer.className).toContain('zd:bg-bright-tertiary')
    })

    it('applies the bright-secondary surface by default', () => {
      const { container } = render(<Wrapper>Soft</Wrapper>)
      const outer = container.firstChild as HTMLElement
      expect(outer.className).toContain('zd:bg-bright-secondary')
    })

    it('applies the bright-secondary surface for soft explicitly', () => {
      const { container } = render(<Wrapper variant="soft">Soft</Wrapper>)
      const outer = container.firstChild as HTMLElement
      expect(outer.className).toContain('zd:bg-bright-secondary')
    })

    it('applies the bright-primary surface for solid', () => {
      const { container } = render(<Wrapper variant="solid">Solid</Wrapper>)
      const outer = container.firstChild as HTMLElement
      expect(outer.className).toContain('zd:bg-bright-primary')
    })

    it('lets a className override the surface', () => {
      const { container } = render(
        <Wrapper className="zd:bg-inverse-secondary">Dark</Wrapper>,
      )
      const outer = container.firstChild as HTMLElement
      expect(outer.className).toContain('zd:bg-inverse-secondary')
      expect(outer.className).not.toContain('zd:bg-bright-secondary')
    })
  })
})
