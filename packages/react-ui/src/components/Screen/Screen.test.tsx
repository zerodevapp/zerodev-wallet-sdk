import { cleanup, render, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import { useZdPortalContainer } from '../../utils/portal'
import { Screen } from './index'

afterEach(() => {
  cleanup()
})

/** Reports the portal container a component inside the frame would use. */
function PortalProbe({
  onContainer,
}: {
  onContainer: (container: HTMLElement | undefined) => void
}) {
  const container = useZdPortalContainer()
  useEffect(() => {
    onContainer(container)
  }, [container, onContainer])
  return null
}

describe('Screen', () => {
  describe('portals', () => {
    it('carries both the brand art and the plain layers for the stylesheet to pick', () => {
      // Which one shows is decided by the `zd:plain:` variant on
      // data-zd-brand, so the DOM holds both whatever the theme.
      const { container } = render(<Screen>x</Screen>)
      const art = container.querySelectorAll('.zd\\:plain\\:hidden')
      expect(art.length).toBe(2)
      const layers = container.querySelectorAll('.zd\\:plain\\:block')
      // The card's branded art holds a drawing per mode, picked by the
      // `zd:dark:` variant; the dark one is the frosted ink card on the ring.
      expect(container.querySelector('.zd\\:dark\\:hidden')).not.toBeNull()
      expect(
        container.querySelector(
          '.zd\\:dark\\:contents .zd\\:bg-neutral-primary',
        ),
      ).not.toBeNull()
      expect(layers.length).toBe(2)
      expect(layers[0]?.className).toContain('zd:bg-frame-ring')
      expect(layers[1]?.className).toContain('zd:bg-neutral-primary')
    })

    it('hands its subtree the shared portal root under document.body', async () => {
      let container: HTMLElement | undefined
      render(
        <Screen>
          <PortalProbe
            onContainer={(c) => {
              container = c
            }}
          />
        </Screen>,
      )
      await waitFor(() => expect(container).toBeDefined())
      expect(container?.id).toBe('zd-portal-root')
      expect(container?.parentElement).toBe(document.body)
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
      // WrapperBorder (6 token layers) + CardGlow colour stack (6) +
      // DarkCardBase (2: the haze and its warm side) = 14 radial gradients.
      // (MultiRadialBackground's base is a flat rect, no gradient.)
      const gradients = container.querySelectorAll('radialGradient')
      expect(gradients.length).toBe(14)
    })
  })
})
