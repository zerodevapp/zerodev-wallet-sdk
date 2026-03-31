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
    it('applies ghost background alpha (0.2)', () => {
      const { container } = render(<Wrapper variant="ghost">Ghost</Wrapper>)
      const outer = container.firstChild as HTMLElement
      expect(outer.style.backgroundColor).toBe('rgba(247, 245, 240, 0.2)')
    })

    it('applies soft background alpha (0.4) by default', () => {
      const { container } = render(<Wrapper>Soft</Wrapper>)
      const outer = container.firstChild as HTMLElement
      expect(outer.style.backgroundColor).toBe('rgba(247, 245, 240, 0.4)')
    })

    it('applies soft background alpha (0.4) explicitly', () => {
      const { container } = render(<Wrapper variant="soft">Soft</Wrapper>)
      const outer = container.firstChild as HTMLElement
      expect(outer.style.backgroundColor).toBe('rgba(247, 245, 240, 0.4)')
    })

    it('applies solid background alpha (0.8)', () => {
      const { container } = render(<Wrapper variant="solid">Solid</Wrapper>)
      const outer = container.firstChild as HTMLElement
      expect(outer.style.backgroundColor).toBe('rgba(247, 245, 240, 0.8)')
    })
  })
})
