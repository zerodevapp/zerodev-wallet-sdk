import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { OrView } from './index'

afterEach(() => {
  cleanup()
})

describe('OrView', () => {
  describe('rendering', () => {
    it('renders "or" text', () => {
      render(<OrView />)
      expect(screen.getByText('or')).toBeDefined()
    })

    it('renders with correct structure', () => {
      const { container } = render(<OrView />)
      const wrapper = container.firstChild as HTMLElement
      expect(wrapper.className).toContain('flex')
      expect(wrapper.className).toContain('flex-row')
      expect(wrapper.className).toContain('items-center')
      expect(wrapper.className).toContain('gap-2')
    })

    it('renders three child elements (divider, text, divider)', () => {
      const { container } = render(<OrView />)
      const wrapper = container.firstChild as HTMLElement
      expect(wrapper.children.length).toBe(3)
    })

    it('renders dividers with correct styling', () => {
      const { container } = render(<OrView />)
      const dividers = container.querySelectorAll('.flex-1.h-px')
      expect(dividers.length).toBe(2)
      dividers.forEach((divider) => {
        expect(divider.className).toContain('bg-greyScale/30')
      })
    })
  })

  describe('text styling', () => {
    it('renders text with body3 size', () => {
      render(<OrView />)
      const text = screen.getByText('or')
      expect(text.className).toContain('text-body3')
    })

    it('renders text with greyScale/30 color', () => {
      render(<OrView />)
      const text = screen.getByText('or')
      expect(text.className).toContain('text-greyScale/30')
    })
  })
})
