import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Input } from './index'

afterEach(() => {
  cleanup()
})

describe('Input', () => {
  describe('rendering', () => {
    it('renders a text input by default', () => {
      render(<Input placeholder="Name" />)
      const input = screen.getByPlaceholderText('Name')
      expect(input.tagName).toBe('INPUT')
    })

    it('renders a textarea when multiline is true', () => {
      render(<Input multiline placeholder="Message" />)
      const textarea = screen.getByPlaceholderText('Message')
      expect(textarea.tagName).toBe('TEXTAREA')
    })

    it('renders placeholder text', () => {
      render(<Input placeholder="Enter amount" />)
      expect(screen.getByPlaceholderText('Enter amount')).toBeDefined()
    })

    it('renders children alongside the input', () => {
      render(
        <Input placeholder="Amount">
          <span data-testid="suffix">ETH</span>
        </Input>,
      )
      expect(screen.getByPlaceholderText('Amount')).toBeDefined()
      expect(screen.getByTestId('suffix')).toBeDefined()
    })
  })

  describe('variants', () => {
    it('wraps in a Wrapper for the default variant', () => {
      render(<Input placeholder="Default" />)
      expect(screen.getByTestId('input-wrapper')).not.toBeNull()
    })

    it('does not wrap in a Wrapper for the ghost variant', () => {
      render(<Input variant="ghost" placeholder="Ghost" />)
      expect(screen.queryByTestId('input-wrapper')).toBeNull()
    })

    it('wraps in a Wrapper for the listItemStyle variant', () => {
      render(<Input variant="listItemStyle" placeholder="List" />)
      expect(screen.getByTestId('input-wrapper')).not.toBeNull()
    })

    it('applies pl-4 padding for default variant', () => {
      render(<Input placeholder="Default" />)
      expect(screen.getByTestId('input-wrapper').className).toContain('pl-4')
    })

    it('applies pl-2 padding for listItemStyle variant', () => {
      render(<Input variant="listItemStyle" placeholder="List" />)
      expect(screen.getByTestId('input-wrapper').className).toContain('pl-2')
    })
  })

  describe('height classes', () => {
    it('applies h-11 for default single-line', () => {
      render(<Input placeholder="Default" />)
      expect(screen.getByTestId('input-wrapper').className).toContain('h-11')
    })

    it('applies h-32 for multiline', () => {
      render(<Input multiline placeholder="Multi" />)
      expect(screen.getByTestId('input-wrapper').className).toContain('h-32')
    })

    it('applies h-17 for listItemStyle', () => {
      render(<Input variant="listItemStyle" placeholder="List" />)
      expect(screen.getByTestId('input-wrapper').className).toContain('h-17')
    })
  })

  describe('focus behavior', () => {
    it('keeps the Wrapper soft and adds a white tint overlay on focus', () => {
      const { container } = render(<Input placeholder="Focus me" />)
      const input = screen.getByPlaceholderText('Focus me')
      const wrapper = screen.getByTestId('input-wrapper')

      // Wrapper stays on the soft variant (alpha 0.5) before and after focus;
      // the focused state is conveyed by a bg-white/20 overlay, not a variant
      // change.
      expect(wrapper.style.backgroundColor).toBe('rgba(255, 255, 255, 0.5)')
      expect(container.querySelector('.zd\\:bg-white\\/20')).toBeNull()

      fireEvent.focus(input)
      expect(wrapper.style.backgroundColor).toBe('rgba(255, 255, 255, 0.5)')
      expect(container.querySelector('.zd\\:bg-white\\/20')).not.toBeNull()
    })

    it('removes the tint overlay on blur', () => {
      const { container } = render(<Input placeholder="Blur me" />)
      const input = screen.getByPlaceholderText('Blur me')

      fireEvent.focus(input)
      expect(container.querySelector('.zd\\:bg-white\\/20')).not.toBeNull()

      fireEvent.blur(input)
      expect(container.querySelector('.zd\\:bg-white\\/20')).toBeNull()
    })

    it('calls the original onFocus handler', () => {
      const handleFocus = vi.fn()
      render(<Input placeholder="Test" onFocus={handleFocus} />)
      fireEvent.focus(screen.getByPlaceholderText('Test'))
      expect(handleFocus).toHaveBeenCalledTimes(1)
    })

    it('calls the original onBlur handler', () => {
      const handleBlur = vi.fn()
      render(<Input placeholder="Test" onBlur={handleBlur} />)
      const input = screen.getByPlaceholderText('Test')
      fireEvent.focus(input)
      fireEvent.blur(input)
      expect(handleBlur).toHaveBeenCalledTimes(1)
    })

    it('does not track focus state for ghost variant', () => {
      render(<Input variant="ghost" placeholder="Ghost" />)
      const input = screen.getByPlaceholderText('Ghost')
      fireEvent.focus(input)
      // Ghost variant renders no Wrapper at all
      expect(screen.queryByTestId('input-wrapper')).toBeNull()
    })
  })

  describe('multiline', () => {
    it('renders textarea for multiline ghost variant', () => {
      render(<Input variant="ghost" multiline placeholder="Notes" />)
      const el = screen.getByPlaceholderText('Notes')
      expect(el.tagName).toBe('TEXTAREA')
    })

    it('applies resize-none to multiline textarea', () => {
      render(<Input multiline placeholder="No resize" />)
      const textarea = screen.getByPlaceholderText('No resize')
      expect(textarea.className).toContain('resize-none')
    })
  })

  describe('event handling', () => {
    it('calls onChange when text is entered', () => {
      const handleChange = vi.fn()
      render(<Input placeholder="Type" onChange={handleChange} />)
      fireEvent.change(screen.getByPlaceholderText('Type'), {
        target: { value: 'hello' },
      })
      expect(handleChange).toHaveBeenCalledTimes(1)
    })

    it('calls onChange on multiline textarea', () => {
      const handleChange = vi.fn()
      render(<Input multiline placeholder="Type" onChange={handleChange} />)
      fireEvent.change(screen.getByPlaceholderText('Type'), {
        target: { value: 'hello\nworld' },
      })
      expect(handleChange).toHaveBeenCalledTimes(1)
    })
  })

  describe('disabled state', () => {
    it('disables the input', () => {
      render(<Input placeholder="Disabled" disabled />)
      const input = screen.getByPlaceholderText('Disabled') as HTMLInputElement
      expect(input.disabled).toBe(true)
    })

    it('disables the textarea when multiline', () => {
      render(<Input multiline placeholder="Disabled" disabled />)
      const textarea = screen.getByPlaceholderText(
        'Disabled',
      ) as HTMLTextAreaElement
      expect(textarea.disabled).toBe(true)
    })
  })

  describe('HTML attribute passthrough', () => {
    it('passes through type attribute', () => {
      render(<Input placeholder="Email" type="email" />)
      const input = screen.getByPlaceholderText('Email') as HTMLInputElement
      expect(input.type).toBe('email')
    })

    it('passes through aria-label', () => {
      render(<Input placeholder="Search" aria-label="Search input" />)
      expect(screen.getByLabelText('Search input')).toBeDefined()
    })

    it('passes through data-testid', () => {
      render(<Input placeholder="Test" data-testid="my-input" />)
      expect(screen.getByTestId('my-input')).toBeDefined()
    })

    it('passes through inputMode', () => {
      render(<Input placeholder="Number" inputMode="numeric" />)
      const input = screen.getByPlaceholderText('Number') as HTMLInputElement
      expect(input.inputMode).toBe('numeric')
    })
  })

  describe('className merging', () => {
    it('merges custom className on the input element', () => {
      render(<Input placeholder="Custom" className="my-custom-class" />)
      const input = screen.getByPlaceholderText('Custom')
      expect(input.className).toContain('my-custom-class')
      expect(input.className).toContain('outline-none')
    })
  })

  describe('icon rendering', () => {
    it('does not render icon when iconName is not provided', () => {
      const { container } = render(<Input placeholder="No icon" />)
      const svg = container.querySelector('svg')
      expect(svg).toBeNull()
    })

    it('renders icon with wrapper for listItemStyle variant', () => {
      const { container } = render(
        <Input variant="listItemStyle" iconName="check" placeholder="List" />,
      )
      // Should have the icon wrapper div
      const iconWrapper = container.querySelector('.zd\\:bg-white')
      expect(iconWrapper).not.toBeNull()
      expect(iconWrapper?.className).toContain('w-13')
      expect(iconWrapper?.className).toContain('h-13')
      expect(iconWrapper?.className).toContain('rounded-2xl')
    })

    it('does not render icon for ghost variant even if iconName is provided', () => {
      const { container } = render(
        <Input variant="ghost" iconName="check" placeholder="Ghost" />,
      )
      // Ghost variant doesn't use the Wrapper, so icon won't render
      const svg = container.querySelector('svg')
      expect(svg).toBeNull()
    })
  })
})
