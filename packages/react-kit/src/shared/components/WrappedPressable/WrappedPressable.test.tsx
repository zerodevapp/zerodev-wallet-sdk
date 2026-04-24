import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { WrappedPressable } from './index'

afterEach(() => {
  cleanup()
})

describe('WrappedPressable', () => {
  describe('rendering', () => {
    it('renders children', () => {
      render(
        <WrappedPressable>
          <span>Press me</span>
        </WrappedPressable>,
      )
      expect(screen.getByText('Press me')).toBeDefined()
    })

    it('renders as a button element', () => {
      render(<WrappedPressable>Press</WrappedPressable>)
      expect(screen.getByRole('button')).toBeDefined()
    })

    it('defaults to type="button"', () => {
      render(<WrappedPressable>Press</WrappedPressable>)
      expect(screen.getByRole('button').getAttribute('type')).toBe('button')
    })
  })

  describe('className merging', () => {
    it('merges custom className onto the wrapper', () => {
      render(
        <WrappedPressable className="my-custom-class">Press</WrappedPressable>,
      )
      const wrapper = screen.getByRole('button').parentElement
      expect(wrapper?.className).toContain('my-custom-class')
      expect(wrapper?.className).toContain('rounded-xl')
    })
  })

  describe('hover behavior', () => {
    it('switches wrapper variant on hover', () => {
      render(<WrappedPressable>Press</WrappedPressable>)
      const button = screen.getByRole('button')
      const wrapper = button.parentElement as HTMLElement

      // default = ghost (alpha 0.2)
      expect(wrapper.style.backgroundColor).toBe('rgba(247, 245, 240, 0.2)')

      fireEvent.mouseEnter(button)
      // hovered = soft (alpha 0.4)
      expect(wrapper.style.backgroundColor).toBe('rgba(247, 245, 240, 0.4)')

      fireEvent.mouseLeave(button)
      expect(wrapper.style.backgroundColor).toBe('rgba(247, 245, 240, 0.2)')
    })

    it('forwards onMouseEnter and onMouseLeave', () => {
      const onMouseEnter = vi.fn()
      const onMouseLeave = vi.fn()
      render(
        <WrappedPressable
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
        >
          Press
        </WrappedPressable>,
      )
      const button = screen.getByRole('button')
      fireEvent.mouseEnter(button)
      fireEvent.mouseLeave(button)
      expect(onMouseEnter).toHaveBeenCalledTimes(1)
      expect(onMouseLeave).toHaveBeenCalledTimes(1)
    })
  })

  describe('event handling', () => {
    it('calls onClick when clicked', () => {
      const handleClick = vi.fn()
      render(<WrappedPressable onClick={handleClick}>Press</WrappedPressable>)
      fireEvent.click(screen.getByRole('button'))
      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('does not call onClick when disabled', () => {
      const handleClick = vi.fn()
      render(
        <WrappedPressable disabled onClick={handleClick}>
          Press
        </WrappedPressable>,
      )
      fireEvent.click(screen.getByRole('button'))
      expect(handleClick).not.toHaveBeenCalled()
    })
  })

  describe('HTML attribute passthrough', () => {
    it('passes through aria-label', () => {
      render(<WrappedPressable aria-label="Confirm">Press</WrappedPressable>)
      expect(screen.getByRole('button', { name: 'Confirm' })).toBeDefined()
    })
  })
})
