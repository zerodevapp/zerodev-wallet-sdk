import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { ScreenWrapper } from './index'

afterEach(() => {
  cleanup()
})

describe('ScreenWrapper', () => {
  describe('rendering', () => {
    it('renders children', () => {
      const { container } = render(
        <ScreenWrapper>
          <div data-testid="child">hello</div>
        </ScreenWrapper>,
      )
      const child = container.querySelector('[data-testid="child"]')
      expect(child).toBeDefined()
      expect(child?.textContent).toBe('hello')
    })

    it('renders topNav above children', () => {
      const { container } = render(
        <ScreenWrapper topNav={<div data-testid="top-nav">nav</div>}>
          <div data-testid="child">content</div>
        </ScreenWrapper>,
      )
      expect(container.querySelector('[data-testid="top-nav"]')).toBeDefined()
      expect(container.querySelector('[data-testid="child"]')).toBeDefined()
    })
  })

  describe('structure', () => {
    it('renders with correct container classes', () => {
      const { container } = render(
        <ScreenWrapper>
          <div>Content</div>
        </ScreenWrapper>,
      )
      const wrapper = container.firstChild as HTMLElement
      expect(wrapper.className).toContain('flex-1')
    })

    it('renders MultiRadialBackground', () => {
      const { container } = render(
        <ScreenWrapper>
          <div>Content</div>
        </ScreenWrapper>,
      )
      const svg = container.querySelector('svg')
      expect(svg).toBeDefined()
    })

    it('renders content wrapper with correct styling', () => {
      const { container } = render(
        <ScreenWrapper>
          <div>Content</div>
        </ScreenWrapper>,
      )
      const contentWrapper = container.querySelector('.bg-offWhite\\/85')
      expect(contentWrapper).toBeDefined()
      expect(contentWrapper?.className).toContain('rounded-[30px]')
      expect(contentWrapper?.className).toContain('m-1.5')
      expect(contentWrapper?.className).toContain('px-4')
      expect(contentWrapper?.className).toContain('overflow-hidden')
    })
  })

  describe('background gradients', () => {
    it('renders base background color', () => {
      const { container } = render(
        <ScreenWrapper>
          <div>Content</div>
        </ScreenWrapper>,
      )
      const baseRect = container.querySelector('rect[fill="#130E0B"]')
      expect(baseRect).toBeDefined()
    })

    it('renders multiple gradient layers', () => {
      const { container } = render(
        <ScreenWrapper>
          <div>Content</div>
        </ScreenWrapper>,
      )
      const gradients = container.querySelectorAll('radialGradient')
      expect(gradients.length).toBe(5)
    })
  })
})
