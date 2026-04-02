import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Button } from './index'

afterEach(() => {
  cleanup()
})

describe('Button', () => {
  describe('rendering', () => {
    it('renders with text', () => {
      render(<Button text="Connect Wallet" />)
      expect(screen.getByText('Connect Wallet')).toBeDefined()
    })

    it('defaults to role="button"', () => {
      render(<Button text="Click me" />)
      expect(screen.getByRole('button')).toBeDefined()
    })

    it('renders without text when text is not provided', () => {
      render(<Button />)
      const button = screen.getByRole('button')
      expect(button).toBeDefined()
    })

    it('renders text for each action variant', () => {
      const { unmount } = render(<Button text="Primary" action="primary" />)
      expect(screen.getByText('Primary')).toBeDefined()
      unmount()

      const { unmount: unmount2 } = render(
        <Button text="Secondary" action="secondary" />,
      )
      expect(screen.getByText('Secondary')).toBeDefined()
      unmount2()

      render(<Button text="Neutral" action="secondaryNeutral" />)
      expect(screen.getByText('Neutral')).toBeDefined()
    })
  })

  describe('disabled state', () => {
    it('is not disabled by default', () => {
      render(<Button text="Enabled" />)
      const button = screen.getByRole('button')
      expect(button.getAttribute('aria-disabled')).toBeNull()
    })

    it('sets aria-disabled when disabled', () => {
      render(<Button text="Disabled" disabled />)
      const button = screen.getByRole('button')
      expect(button.getAttribute('aria-disabled')).toBe('true')
    })
  })

  describe('event handling', () => {
    it('calls onPress when pressed', () => {
      const onPress = vi.fn()
      render(<Button text="Press me" onPress={onPress} />)
      fireEvent.click(screen.getByRole('button'))
      expect(onPress).toHaveBeenCalledTimes(1)
    })

    it('does not call onPress when disabled', () => {
      const onPress = vi.fn()
      render(<Button text="Disabled" disabled onPress={onPress} />)
      fireEvent.click(screen.getByRole('button'))
      expect(onPress).not.toHaveBeenCalled()
    })
  })

  describe('accessibility', () => {
    it('passes through aria-label', () => {
      render(<Button text="X" aria-label="Close dialog" />)
      const button = screen.getByRole('button', { name: 'Close dialog' })
      expect(button).toBeDefined()
    })

    it('allows overriding the role', () => {
      render(<Button text="Link-like" role="link" />)
      expect(screen.getByRole('link')).toBeDefined()
    })
  })
})
