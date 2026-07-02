import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { Text } from './index'

afterEach(() => {
  cleanup()
})

describe('Text', () => {
  describe('rendering', () => {
    it('renders children text', () => {
      render(<Text>Hello world</Text>)
      expect(screen.getByText('Hello world')).toBeDefined()
    })

    it('renders as a <p> tag by default', () => {
      render(<Text>Paragraph</Text>)
      const el = screen.getByText('Paragraph')
      expect(el.tagName).toBe('P')
    })

    it('renders as <span> when as="span"', () => {
      render(<Text as="span">Inline</Text>)
      const el = screen.getByText('Inline')
      expect(el.tagName).toBe('SPAN')
    })

    it('renders as <label> when as="label"', () => {
      render(<Text as="label">Label text</Text>)
      const el = screen.getByText('Label text')
      expect(el.tagName).toBe('LABEL')
    })
  })

  describe('default styling', () => {
    it('applies default font-medium class', () => {
      render(<Text>Styled</Text>)
      const el = screen.getByText('Styled')
      expect(el.className).toContain('font-medium')
    })

    it('applies default font size', () => {
      render(<Text>Styled</Text>)
      const el = screen.getByText('Styled')
      expect(el.className).toContain('text-body2')
    })

    it('applies default text color', () => {
      render(<Text>Styled</Text>)
      const el = screen.getByText('Styled')
      expect(el.className).toContain('text-greyScale')
    })

    it('applies custom font family via font-sans class', () => {
      render(<Text>Styled</Text>)
      const el = screen.getByText('Styled')
      expect(el.className).toContain('font-sans')
      expect(el.className).not.toContain('font-roboto')
    })
  })

  describe('className merging', () => {
    it('merges custom className with defaults', () => {
      render(<Text className="text-red-500">Custom</Text>)
      const el = screen.getByText('Custom')
      expect(el.className).toContain('text-red-500')
      expect(el.className).toContain('font-medium')
    })

    it('allows overriding default classes via tailwind-merge', () => {
      render(<Text className="zd:font-bold">Bold</Text>)
      const el = screen.getByText('Bold')
      expect(el.className).toContain('font-bold')
      expect(el.className).not.toContain('font-medium')
    })

    it('allows overriding font family', () => {
      render(<Text className="zd:font-roboto">Roboto</Text>)
      const el = screen.getByText('Roboto')
      expect(el.className).toContain('font-roboto')
      expect(el.className).not.toContain('font-sans')
    })
  })

  describe('HTML attribute passthrough', () => {
    it('passes through aria-label', () => {
      render(<Text aria-label="description">Accessible</Text>)
      const el = screen.getByText('Accessible')
      expect(el.getAttribute('aria-label')).toBe('description')
    })

    it('passes through data attributes', () => {
      render(<Text data-testid="my-text">Data</Text>)
      expect(screen.getByTestId('my-text')).toBeDefined()
    })

    it('passes through onClick', () => {
      let clicked = false
      render(<Text onClick={() => (clicked = true)}>Clickable</Text>)
      screen.getByText('Clickable').click()
      expect(clicked).toBe(true)
    })
  })
})
