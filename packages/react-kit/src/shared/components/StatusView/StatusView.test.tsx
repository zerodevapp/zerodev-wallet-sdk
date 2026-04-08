import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { StatusView } from './index'

afterEach(() => {
  cleanup()
})

describe('StatusView', () => {
  describe('rendering', () => {
    it('renders the title', () => {
      render(
        <StatusView imageName="success" title="Transaction Sent">
          Your funds are on the way.
        </StatusView>,
      )
      expect(screen.getByText('Transaction Sent')).toBeDefined()
    })

    it('renders children text', () => {
      render(
        <StatusView imageName="success" title="Done">
          Your funds are on the way.
        </StatusView>,
      )
      expect(screen.getByText('Your funds are on the way.')).toBeDefined()
    })

    it('renders children as ReactNode', () => {
      render(
        <StatusView imageName="loading" title="Loading">
          <span data-testid="custom-child">Please wait...</span>
        </StatusView>,
      )
      expect(screen.getByTestId('custom-child')).toBeDefined()
    })
  })

  describe('image rendering', () => {
    it('renders image for each imageName', () => {
      render(
        <StatusView imageName="error" title="Something went wrong">
          Please try again.
        </StatusView>,
      )
      const img = screen.getByAltText('error')
      expect(img).toBeDefined()
      expect(img.tagName).toBe('IMG')
    })

    it.each(['error', 'loading', 'send', 'success'] as const)(
      'renders %s image with correct alt text',
      (imageName) => {
        render(
          <StatusView imageName={imageName} title="Test">
            Content
          </StatusView>,
        )
        const img = screen.getByAltText(imageName)
        expect(img).toBeDefined()
      },
    )

    it('applies fixed dimensions class to image', () => {
      render(
        <StatusView imageName="send" title="Sending">
          In progress
        </StatusView>,
      )
      const img = screen.getByAltText('send')
      expect(img.className).toContain('w-[118px]')
      expect(img.className).toContain('h-[118px]')
    })
  })

  describe('className merging', () => {
    it('applies custom className to the root container', () => {
      const { container } = render(
        <StatusView
          imageName="success"
          title="Done"
          className="my-custom-class"
        >
          Content
        </StatusView>,
      )
      const root = container.firstElementChild
      expect(root?.className).toContain('my-custom-class')
    })

    it('keeps base classes when custom className is applied', () => {
      const { container } = render(
        <StatusView
          imageName="success"
          title="Done"
          className="my-custom-class"
        >
          Content
        </StatusView>,
      )
      const root = container.firstElementChild
      expect(root?.className).toContain('items-center')
      expect(root?.className).toContain('gap-8')
    })
  })

  describe('structure', () => {
    it('renders title in an h2 element', () => {
      render(
        <StatusView imageName="success" title="Success!">
          Done
        </StatusView>,
      )
      const heading = screen.getByRole('heading', { level: 2 })
      expect(heading.textContent).toBe('Success!')
    })
  })
})
