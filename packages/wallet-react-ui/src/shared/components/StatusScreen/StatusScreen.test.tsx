import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { StatusScreen } from './index'

afterEach(() => {
  cleanup()
})

describe('StatusScreen', () => {
  describe('rendering', () => {
    it('renders the title', () => {
      render(
        <StatusScreen imageName="success" title="Transaction Sent">
          Your funds are on the way.
        </StatusScreen>,
      )
      expect(screen.getByText('Transaction Sent')).toBeDefined()
    })

    it('renders children text', () => {
      render(
        <StatusScreen imageName="success" title="Done">
          Your funds are on the way.
        </StatusScreen>,
      )
      expect(screen.getByText('Your funds are on the way.')).toBeDefined()
    })

    it('renders children as ReactNode', () => {
      render(
        <StatusScreen imageName="loading" title="Loading">
          <span data-testid="custom-child">Please wait...</span>
        </StatusScreen>,
      )
      expect(screen.getByTestId('custom-child')).toBeDefined()
    })
  })

  describe('image rendering', () => {
    it('renders image for each imageName', () => {
      render(
        <StatusScreen imageName="error" title="Something went wrong">
          Please try again.
        </StatusScreen>,
      )
      const img = screen.getByAltText('error')
      expect(img).toBeDefined()
      expect(img.tagName).toBe('IMG')
    })

    it.each(['error', 'loading', 'send', 'success'] as const)(
      'renders %s image with correct alt text',
      (imageName) => {
        render(
          <StatusScreen imageName={imageName} title="Test">
            Content
          </StatusScreen>,
        )
        const img = screen.getByAltText(imageName)
        expect(img).toBeDefined()
      },
    )

    it('applies fixed dimensions class to image', () => {
      render(
        <StatusScreen imageName="send" title="Sending">
          In progress
        </StatusScreen>,
      )
      const img = screen.getByAltText('send')
      expect(img.className).toContain('w-[118px]')
      expect(img.className).toContain('h-[118px]')
    })
  })

  describe('className merging', () => {
    it('applies custom className to the root container', () => {
      const { container } = render(
        <StatusScreen
          imageName="success"
          title="Done"
          className="my-custom-class"
        >
          Content
        </StatusScreen>,
      )
      const root = container.firstElementChild
      expect(root?.className).toContain('my-custom-class')
    })

    it('keeps base classes when custom className is applied', () => {
      const { container } = render(
        <StatusScreen
          imageName="success"
          title="Done"
          className="my-custom-class"
        >
          Content
        </StatusScreen>,
      )
      const root = container.firstElementChild
      expect(root?.className).toContain('items-center')
      expect(root?.className).toContain('gap-8')
    })
  })

  describe('structure', () => {
    it('renders title with text-h2 styling', () => {
      render(
        <StatusScreen imageName="success" title="Success!">
          Done
        </StatusScreen>,
      )
      const titleElement = screen.getByText('Success!')
      expect(titleElement.className).toContain('text-h2')
      expect(titleElement.className).toContain('text-center')
    })
  })
})
