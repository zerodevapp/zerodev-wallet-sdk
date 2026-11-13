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

/** Mounts a Screen and resolves with the portal container it hands out. */
function renderWithPortal(ui: (probe: React.ReactNode) => React.ReactElement) {
  let container: HTMLElement | undefined
  const probe = (
    <PortalProbe
      onContainer={(c) => {
        container = c
      }}
    />
  )
  const result = render(ui(probe))
  const portalRoot = () => document.getElementById('zd-portal-root')
  return {
    ...result,
    portalRoot,
    /** The frame's own container, once it exists. */
    container: () =>
      waitFor(() => {
        if (!container || container === portalRoot()) throw new Error('pending')
        return container
      }),
  }
}

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

    it('accepts a preset name', () => {
      const { container } = render(<Screen theme="plain-light">x</Screen>)
      const root = container.firstChild as HTMLElement
      expect(root.getAttribute('data-zd-mode')).toBe('light')
      expect(root.getAttribute('data-zd-brand')).toBe('plain')
    })

    it('gives its subtree a portal container under the portal root, themed like the frame, gone on unmount', async () => {
      const { container, portalRoot, unmount } = renderWithPortal((probe) => (
        <Screen
          theme={{
            mode: 'light',
            brand: 'plain',
            tokens: { 'bg-neutral-primary': '#0b1020' },
          }}
        >
          {probe}
        </Screen>
      ))
      const el = await container()
      expect(el.parentElement).toBe(portalRoot())
      expect(el.getAttribute('data-zd-mode')).toBe('light')
      expect(el.getAttribute('data-zd-brand')).toBe('plain')
      expect(el.style.getPropertyValue('--zd-bg-neutral-primary')).toBe(
        '#0b1020',
      )
      unmount()
      expect(el.isConnected).toBe(false)
      // The shared root itself never carries a theme.
      expect(portalRoot()?.hasAttribute('data-zd-brand')).toBe(false)
    })

    it("without a theme, mirrors the nearest ancestor's attributes onto its container and follows changes", async () => {
      const { container } = renderWithPortal((probe) => (
        <div data-testid="host" data-zd-mode="light" data-zd-brand="plain">
          <Screen>{probe}</Screen>
        </div>
      ))
      const el = await container()
      await waitFor(() => expect(el.getAttribute('data-zd-mode')).toBe('light'))
      expect(el.getAttribute('data-zd-brand')).toBe('plain')

      const host = document.querySelector('[data-testid="host"]') as HTMLElement
      host.setAttribute('data-zd-brand', 'branded')
      await waitFor(() =>
        expect(el.getAttribute('data-zd-brand')).toBe('branded'),
      )
      host.removeAttribute('data-zd-mode')
      host.removeAttribute('data-zd-brand')
      await waitFor(() => expect(el.hasAttribute('data-zd-brand')).toBe(false))
    })

    it('two frames keep their own containers; unmounting one leaves the other themed', async () => {
      const first = renderWithPortal((probe) => (
        <Screen theme="plain-light">{probe}</Screen>
      ))
      const second = renderWithPortal((probe) => (
        <Screen
          theme={{
            mode: 'light',
            brand: 'branded',
            tokens: { 'bg-neutral-primary': '#abcdef' },
          }}
        >
          {probe}
        </Screen>
      ))
      const a = await first.container()
      const b = await second.container()
      expect(a).not.toBe(b)
      expect(a.getAttribute('data-zd-brand')).toBe('plain')
      expect(a.style.getPropertyValue('--zd-bg-neutral-primary')).toBe('')
      expect(b.getAttribute('data-zd-brand')).toBe('branded')
      expect(b.style.getPropertyValue('--zd-bg-neutral-primary')).toBe(
        '#abcdef',
      )

      first.unmount()
      expect(a.isConnected).toBe(false)
      expect(b.isConnected).toBe(true)
      expect(b.getAttribute('data-zd-brand')).toBe('branded')
      expect(b.style.getPropertyValue('--zd-bg-neutral-primary')).toBe(
        '#abcdef',
      )
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
