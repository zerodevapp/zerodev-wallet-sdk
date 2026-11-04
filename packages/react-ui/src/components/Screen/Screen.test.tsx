import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { Screen } from './index'

afterEach(() => {
  cleanup()
})

describe('Screen', () => {
  describe('theme', () => {
    it('writes no theme attributes when none is given', () => {
      const { container } = render(<Screen>x</Screen>)
      const root = container.firstChild as HTMLElement
      expect(root.hasAttribute('data-zd-mode')).toBe(false)
      expect(root.hasAttribute('data-zd-brand')).toBe(false)
    })

    it('writes the preset attributes and token overrides on the root', () => {
      const { container } = render(
        <Screen
          theme={{
            mode: 'system',
            brand: 'plain',
            tokens: { 'bg-neutral-primary': '#0b1020' },
          }}
        >
          x
        </Screen>,
      )
      const root = container.firstChild as HTMLElement
      expect(root.getAttribute('data-zd-mode')).toBe('system')
      expect(root.getAttribute('data-zd-brand')).toBe('plain')
      expect(root.style.getPropertyValue('--zd-bg-neutral-primary')).toBe(
        '#0b1020',
      )
    })

    it('carries both the brand art and the plain surface for the stylesheet to pick', () => {
      // Which one shows is decided by theme/brand.css on data-zd-brand, so
      // the DOM holds both whatever the theme.
      const { container } = render(<Screen theme="plain-dark">x</Screen>)
      expect(container.querySelectorAll('.zd-brand-art').length).toBe(2)
      const surface = container.querySelector('.zd-plain-surface')
      expect(surface?.className).toContain('zd:bg-neutral-primary')
      expect(container.querySelector('.zd-screen-card')).not.toBeNull()
    })

    it('accepts a preset name', () => {
      const { container } = render(<Screen theme="plain-light">x</Screen>)
      const root = container.firstChild as HTMLElement
      expect(root.getAttribute('data-zd-mode')).toBe('light')
      expect(root.getAttribute('data-zd-brand')).toBe('plain')
    })

    it('mirrors the theme onto the portal root and clears it on unmount', () => {
      const { unmount } = render(<Screen theme="plain-light">x</Screen>)
      const portalRoot = document.getElementById('zd-portal-root')
      expect(portalRoot?.getAttribute('data-zd-brand')).toBe('plain')
      unmount()
      expect(portalRoot?.hasAttribute('data-zd-brand')).toBe(false)
    })
  })

  describe('rendering', () => {
    it('renders children', () => {
      const { container } = render(
        <Screen>
          <div data-testid="child">hello</div>
        </Screen>,
      )
      const child = container.querySelector('[data-testid="child"]')
      expect(child).toBeDefined()
      expect(child?.textContent).toBe('hello')
    })

    it('renders topNav above children', () => {
      const { container } = render(
        <Screen topNav={<div data-testid="top-nav">nav</div>}>
          <div data-testid="child">content</div>
        </Screen>,
      )
      expect(container.querySelector('[data-testid="top-nav"]')).toBeDefined()
      expect(container.querySelector('[data-testid="child"]')).toBeDefined()
    })
  })

  describe('structure', () => {
    it('renders with correct container classes', () => {
      const { container } = render(
        <Screen>
          <div>Content</div>
        </Screen>,
      )
      const wrapper = container.firstChild as HTMLElement
      // One parent-relative box at every breakpoint: 400×810 at density 1
      // (w-100 / h-202.5), capped to the parent (max-w/h-full), never viewport-
      // pinned — a consumer wrapper controls the final size.
      expect(wrapper.className).toContain('zd:w-100')
      expect(wrapper.className).toContain('zd:h-202.5')
      expect(wrapper.className).toContain('zd:max-w-full')
      expect(wrapper.className).toContain('zd:max-h-full')
    })

    it('defaults to the lg size, and honors the size prop', () => {
      const { container, rerender } = render(
        <Screen>
          <div>Content</div>
        </Screen>,
      )
      // size drives the density scale via the data attribute (see styles.css).
      expect((container.firstChild as HTMLElement).dataset.zdSize).toBe('lg')

      rerender(
        <Screen size="sm">
          <div>Content</div>
        </Screen>,
      )
      expect((container.firstChild as HTMLElement).dataset.zdSize).toBe('sm')
    })

    it('renders MultiRadialBackground', () => {
      const { container } = render(
        <Screen>
          <div>Content</div>
        </Screen>,
      )
      const svg = container.querySelector('svg')
      expect(svg).toBeDefined()
    })

    it('renders content wrapper with correct styling', () => {
      const { container } = render(
        <Screen>
          <div>Content</div>
        </Screen>,
      )
      const contentWrapper = container.querySelector('.zd\\:m-1\\.5')
      expect(contentWrapper).not.toBeNull()
      expect(contentWrapper?.className).toContain('rounded-4xl')
      expect(contentWrapper?.className).toContain('overflow-hidden')
      // Horizontal padding lives on the scroll container, not the card
      // wrapper — so TopNav / footer can span edge-to-edge without
      // negative-margin escapes.
      expect(contentWrapper?.className).not.toContain('px-4')
      const scrollBody = container.querySelector('.zd\\:overflow-y-auto')
      expect(scrollBody?.className).toContain('px-4')
      // No opaque offWhite card — content frosts the gradient directly
      expect(container.querySelector('.bg-offWhite\\/80')).toBeNull()
    })
  })

  describe('background gradients', () => {
    it('renders base background colors', () => {
      const { container } = render(
        <Screen>
          <div>Content</div>
        </Screen>,
      )
      // Dark base behind the gradient border ring (WrapperBorder) + warm-white
      // base behind the card gradient (MultiRadialBackground).
      expect(container.querySelector('rect[fill="#130E0B"]')).not.toBeNull()
      expect(container.querySelector('rect[fill="#FBF7F2"]')).not.toBeNull()
    })

    it('renders multiple gradient layers', () => {
      const { container } = render(
        <Screen>
          <div>Content</div>
        </Screen>,
      )
      // WrapperBorder (6 token layers) + CardGlow color stack (6) = 12 radial
      // gradients. (MultiRadialBackground's base is a flat rect, no gradient.)
      const gradients = container.querySelectorAll('radialGradient')
      expect(gradients.length).toBe(12)
    })
  })
})
