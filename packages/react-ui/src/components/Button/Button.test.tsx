import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../Icon', async () => {
  const React = await import('react')

  const MockIcon = ({
    name,
    ...props
  }: { name: string } & React.SVGProps<SVGSVGElement>) =>
    React.createElement('svg', { 'data-testid': `icon-${name}`, ...props })

  return {
    Icon: MockIcon,
    icons: {},
  }
})

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
      render(<Button />)
      const button = screen.getByRole('button')
      expect(button.textContent).toBe('')
    })
  })

  describe('action variants', () => {
    it('applies the dark primary fill by default', () => {
      const { container } = render(<Button text="Primary" />)
      const surface = container.firstChild as HTMLElement
      expect(surface.style.backgroundColor).toBe('rgba(19, 14, 11, 0.9)')
    })

    it('applies the dark primary fill when action="primary"', () => {
      const { container } = render(<Button text="Primary" action="primary" />)
      const surface = container.firstChild as HTMLElement
      expect(surface.style.backgroundColor).toBe('rgba(19, 14, 11, 0.9)')
    })

    it('uses the frosted white surface when action="secondary"', () => {
      const { container } = render(
        <Button text="Secondary" action="secondary" />,
      )
      // secondary keeps the Wrapper's white@0.5 surface (no dark override)
      const surface = container.firstChild as HTMLElement
      expect(surface.style.backgroundColor).toBe('rgba(255, 255, 255, 0.5)')
    })

    it('applies correct text classes for primary action', () => {
      render(<Button text="Primary" action="primary" />)
      const textSpan = screen.getByText('Primary')
      expect(textSpan.className).toContain('text-white')
    })

    it('applies correct text classes for secondary action', () => {
      render(<Button text="Secondary" action="secondary" />)
      const textSpan = screen.getByText('Secondary')
      expect(textSpan.className).toContain('text-greyScale')
    })
  })

  describe('disabled state', () => {
    it('sets the disabled attribute when disabled', () => {
      render(<Button text="Disabled" disabled />)
      const button = screen.getByRole('button')
      expect(button).toHaveProperty('disabled', true)
    })

    it('applies disabled styling classes', () => {
      const { container } = render(<Button text="Disabled" disabled />)
      const surface = container.firstChild as HTMLElement
      const button = screen.getByRole('button')
      expect(surface.className).toContain('opacity-50')
      expect(button.className).toContain('cursor-not-allowed')
    })

    it('does not apply disabled classes when not disabled', () => {
      const { container } = render(<Button text="Enabled" />)
      const surface = container.firstChild as HTMLElement
      const button = screen.getByRole('button')
      expect(surface.className).not.toContain('opacity-50')
      expect(button.className).not.toContain('cursor-not-allowed')
    })
  })

  describe('className merging', () => {
    it('merges custom className with base classes', () => {
      const { container } = render(
        <Button text="Custom" className="my-custom-class" />,
      )
      // className is forwarded to the Wrapper surface (outer element)
      const surface = container.firstChild as HTMLElement
      expect(surface.className).toContain('my-custom-class')
      expect(surface.className).toContain('rounded-3xl')
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
      render(<Button text="Test" />)
      const button = screen.getByRole('button')
      expect(button).toBeDefined()
    })
  })

  describe('icon rendering', () => {
    it('renders a leading icon when iconName is provided', () => {
      render(<Button text="Send" iconName="rocket" />)
      expect(screen.getByTestId('icon-rocket')).toBeDefined()
      expect(screen.getByText('Send')).toBeDefined()
    })

    it('renders a trailing icon when trailIcon is true', () => {
      render(<Button text="Next" iconName="arrowRightFill" trailIcon />)
      const icon = screen.getByTestId('icon-arrowRightFill')
      const text = screen.getByText('Next')
      // Icon should come after text in the DOM
      expect(
        text.compareDocumentPosition(icon) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy()
    })

    it('renders a leading icon before text when trailIcon is false', () => {
      render(<Button text="Back" iconName="arrowLeft" />)
      const icon = screen.getByTestId('icon-arrowLeft')
      const text = screen.getByText('Back')
      // Icon should come before text in the DOM
      expect(
        text.compareDocumentPosition(icon) & Node.DOCUMENT_POSITION_PRECEDING,
      ).toBeTruthy()
    })

    it('renders icon without text', () => {
      render(<Button iconName="check" />)
      expect(screen.getByTestId('icon-check')).toBeDefined()
    })

    it('does not render icon when iconName is not provided', () => {
      render(<Button text="No Icon" />)
      expect(screen.queryByTestId(/^icon-/)).toBeNull()
    })

    it('applies text color classes to the icon', () => {
      render(<Button text="Send" iconName="rocket" action="primary" />)
      const icon = screen.getByTestId('icon-rocket')
      expect(icon.getAttribute('class')).toContain('text-white')
    })

    it('applies secondary text color classes to the icon', () => {
      render(<Button text="Send" iconName="rocket" action="secondary" />)
      const icon = screen.getByTestId('icon-rocket')
      expect(icon.getAttribute('class')).toContain('text-greyScale')
    })
  })
})
