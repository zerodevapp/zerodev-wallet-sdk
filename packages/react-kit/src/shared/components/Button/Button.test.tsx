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

    it('renders as a <button> element', () => {
      render(<Button text="Click me" />)
      const button = screen.getByRole('button')
      expect(button.tagName).toBe('BUTTON')
    })

    it('defaults to type="button"', () => {
      render(<Button text="Click me" />)
      const button = screen.getByRole('button')
      expect(button.getAttribute('type')).toBe('button')
    })

    it('allows overriding type to "submit"', () => {
      render(<Button text="Submit" type="submit" />)
      const button = screen.getByRole('button')
      expect(button.getAttribute('type')).toBe('submit')
    })

    it('renders without text when text is not provided', () => {
      render(<Button data-testid="empty-btn" />)
      const button = screen.getByTestId('empty-btn')
      expect(button.textContent).toBe('')
    })
  })

  describe('action variants', () => {
    it('applies primary classes by default', () => {
      render(<Button text="Primary" />)
      const button = screen.getByRole('button')
      expect(button.className).toContain('bg-gray-900/90')
    })

    it('applies primary classes when action="primary"', () => {
      render(<Button text="Primary" action="primary" />)
      const button = screen.getByRole('button')
      expect(button.className).toContain('bg-gray-900/90')
    })

    it('applies secondary classes when action="secondary"', () => {
      render(<Button text="Secondary" action="secondary" />)
      const button = screen.getByRole('button')
      expect(button.className).toContain('bg-white/50')
    })

    it('applies secondaryNeutral classes when action="secondaryNeutral"', () => {
      render(<Button text="Neutral" action="secondaryNeutral" />)
      const button = screen.getByRole('button')
      expect(button.className).toContain('bg-gray-700/70')
    })

    it('applies correct text classes for primary action', () => {
      render(<Button text="Primary" action="primary" />)
      const textSpan = screen.getByText('Primary')
      expect(textSpan.className).toContain('text-white')
    })

    it('applies correct text classes for secondary action', () => {
      render(<Button text="Secondary" action="secondary" />)
      const textSpan = screen.getByText('Secondary')
      expect(textSpan.className).toContain('text-gray-900')
    })

    it('applies correct text classes for secondaryNeutral action', () => {
      render(<Button text="Neutral" action="secondaryNeutral" />)
      const textSpan = screen.getByText('Neutral')
      expect(textSpan.className).toContain('text-white')
    })
  })

  describe('disabled state', () => {
    it('sets the disabled attribute when disabled', () => {
      render(<Button text="Disabled" disabled />)
      const button = screen.getByRole('button')
      expect(button).toHaveProperty('disabled', true)
    })

    it('applies disabled styling classes', () => {
      render(<Button text="Disabled" disabled />)
      const button = screen.getByRole('button')
      expect(button.className).toContain('opacity-50')
      expect(button.className).toContain('cursor-not-allowed')
    })

    it('does not apply disabled classes when not disabled', () => {
      render(<Button text="Enabled" />)
      const button = screen.getByRole('button')
      expect(button.className).not.toContain('opacity-50')
      expect(button.className).not.toContain('cursor-not-allowed')
    })
  })

  describe('className merging', () => {
    it('merges custom className with base classes', () => {
      render(<Button text="Custom" className="my-custom-class" />)
      const button = screen.getByRole('button')
      expect(button.className).toContain('my-custom-class')
      expect(button.className).toContain('rounded-3xl')
    })
  })

  describe('event handling', () => {
    it('calls onClick when clicked', () => {
      const handleClick = vi.fn()
      render(<Button text="Click me" onClick={handleClick} />)
      fireEvent.click(screen.getByRole('button'))
      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('does not call onClick when disabled', () => {
      const handleClick = vi.fn()
      render(<Button text="Disabled" disabled onClick={handleClick} />)
      fireEvent.click(screen.getByRole('button'))
      expect(handleClick).not.toHaveBeenCalled()
    })
  })

  describe('HTML attribute passthrough', () => {
    it('passes through aria-label', () => {
      render(<Button text="X" aria-label="Close dialog" />)
      const button = screen.getByRole('button', { name: 'Close dialog' })
      expect(button).toBeDefined()
    })

    it('passes through data attributes', () => {
      render(<Button text="Test" data-testid="my-button" />)
      expect(screen.getByTestId('my-button')).toBeDefined()
    })
  })
})
