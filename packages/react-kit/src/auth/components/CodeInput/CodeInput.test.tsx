import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CodeInput } from '.'

afterEach(() => {
  cleanup()
})

describe('CodeInput', () => {
  describe('rendering', () => {
    it('renders 6 character boxes by default', () => {
      const { container } = render(<CodeInput />)
      const boxes = container.querySelectorAll('.backdrop-blur-md')
      expect(boxes).toHaveLength(6)
    })

    it('renders all boxes as empty initially', () => {
      const { container } = render(<CodeInput />)
      const textElements = container.querySelectorAll('.text-h2')
      Array.from(textElements).forEach((el) => {
        expect(el.textContent).toBe('')
      })
    })

    it('renders with data-testid on the wrapper', () => {
      render(<CodeInput data-testid="otp" />)
      expect(screen.getByTestId('otp')).toBeDefined()
    })

    it('renders a hidden input for accessibility', () => {
      const { container } = render(<CodeInput />)
      const hiddenInput = container.querySelector(
        'input[aria-label="Verification code"]',
      )
      expect(hiddenInput).toBeDefined()
    })
  })

  describe('typing', () => {
    it('accepts a digit in the first box', () => {
      const { container } = render(<CodeInput />)
      const hiddenInput = container.querySelector(
        'input[aria-label="Verification code"]',
      ) as HTMLInputElement
      fireEvent.change(hiddenInput, { target: { value: '3' } })
      const textElements = container.querySelectorAll('.text-h2')
      expect(textElements[0].textContent).toBe('3')
    })

    it('converts input to uppercase', () => {
      const { container } = render(<CodeInput />)
      const hiddenInput = container.querySelector(
        'input[aria-label="Verification code"]',
      ) as HTMLInputElement
      fireEvent.change(hiddenInput, { target: { value: 'abc123' } })
      expect(hiddenInput.value).toBe('ABC123')
    })

    it('calls onChange with the current code after each keystroke', () => {
      const onChange = vi.fn()
      const { container } = render(<CodeInput onChange={onChange} />)
      const hiddenInput = container.querySelector(
        'input[aria-label="Verification code"]',
      ) as HTMLInputElement
      fireEvent.change(hiddenInput, { target: { value: '5' } })
      expect(onChange).toHaveBeenCalledWith('5')
    })

    it('limits input to 6 characters', () => {
      const { container } = render(<CodeInput />)
      const hiddenInput = container.querySelector(
        'input[aria-label="Verification code"]',
      ) as HTMLInputElement
      fireEvent.change(hiddenInput, { target: { value: '1234567890' } })
      expect(hiddenInput.value).toBe('123456')
    })
  })

  describe('onComplete', () => {
    it('calls onComplete when all 6 digits are filled', async () => {
      const onComplete = vi.fn()
      const { container } = render(
        <CodeInput onComplete={onComplete} data-testid="otp" />,
      )
      const hiddenInput = container.querySelector(
        'input[aria-label="Verification code"]',
      ) as HTMLInputElement

      fireEvent.change(hiddenInput, { target: { value: '123456' } })

      // Wait for setTimeout to complete
      await new Promise((resolve) => setTimeout(resolve, 10))

      expect(onComplete).toHaveBeenCalledWith('123456')
    })

    it('does not call onComplete when only some digits are filled', () => {
      const onComplete = vi.fn()
      const { container } = render(<CodeInput onComplete={onComplete} />)
      const hiddenInput = container.querySelector(
        'input[aria-label="Verification code"]',
      ) as HTMLInputElement

      fireEvent.change(hiddenInput, { target: { value: '12' } })

      expect(onComplete).not.toHaveBeenCalled()
    })

    it('blurs the input after completion', async () => {
      const onComplete = vi.fn()
      const { container } = render(<CodeInput onComplete={onComplete} />)
      const hiddenInput = container.querySelector(
        'input[aria-label="Verification code"]',
      ) as HTMLInputElement

      hiddenInput.focus()
      expect(document.activeElement).toBe(hiddenInput)

      fireEvent.change(hiddenInput, { target: { value: '123456' } })

      // Wait for setTimeout to complete
      await new Promise((resolve) => setTimeout(resolve, 10))

      expect(document.activeElement).not.toBe(hiddenInput)
    })
  })

  describe('focus behavior', () => {
    it('focuses the hidden input when clicking on the container', () => {
      const { container } = render(<CodeInput />)
      const button = container.querySelector('button') as HTMLButtonElement
      const hiddenInput = container.querySelector(
        'input[aria-label="Verification code"]',
      ) as HTMLInputElement

      fireEvent.click(button)
      expect(document.activeElement).toBe(hiddenInput)
    })

    it('shows focus border on the current character box when focused', () => {
      const { container } = render(<CodeInput />)
      const hiddenInput = container.querySelector(
        'input[aria-label="Verification code"]',
      ) as HTMLInputElement

      fireEvent.focus(hiddenInput)
      fireEvent.change(hiddenInput, { target: { value: 'AB' } })

      const boxes = container.querySelectorAll('.backdrop-blur-md')
      // Third box (index 2) should have focus border since we have 2 chars
      expect(boxes[2].className).toContain('border-greyScale')
    })

    it('does not show focus border when error is true', () => {
      const { container } = render(<CodeInput error />)
      const hiddenInput = container.querySelector(
        'input[aria-label="Verification code"]',
      ) as HTMLInputElement

      fireEvent.focus(hiddenInput)

      const boxes = container.querySelectorAll('.backdrop-blur-md')
      Array.from(boxes).forEach((box) => {
        expect(box.className).not.toContain('border-greyScale')
      })
    })
  })

  describe('disabled state', () => {
    it('disables the hidden input when disabled=true', () => {
      const { container } = render(<CodeInput disabled />)
      const hiddenInput = container.querySelector(
        'input[aria-label="Verification code"]',
      ) as HTMLInputElement
      expect(hiddenInput.disabled).toBe(true)
    })

    it('disables the button when disabled=true', () => {
      const { container } = render(<CodeInput disabled />)
      const button = container.querySelector('button') as HTMLButtonElement
      expect(button.disabled).toBe(true)
    })

    it('does not focus when clicking while disabled', () => {
      const { container } = render(<CodeInput disabled />)
      const button = container.querySelector('button') as HTMLButtonElement
      const hiddenInput = container.querySelector(
        'input[aria-label="Verification code"]',
      ) as HTMLInputElement

      fireEvent.click(button)
      expect(document.activeElement).not.toBe(hiddenInput)
    })
  })

  describe('autoFocus', () => {
    it('focuses the input when autoFocus is true', () => {
      const { container } = render(<CodeInput autoFocus />)
      const hiddenInput = container.querySelector(
        'input[aria-label="Verification code"]',
      ) as HTMLInputElement
      expect(document.activeElement).toBe(hiddenInput)
    })

    it('does not auto-focus when disabled', () => {
      const { container } = render(<CodeInput autoFocus disabled />)
      const hiddenInput = container.querySelector(
        'input[aria-label="Verification code"]',
      ) as HTMLInputElement
      expect(document.activeElement).not.toBe(hiddenInput)
    })
  })

  describe('character display', () => {
    it('displays characters in the correct boxes', () => {
      const { container } = render(<CodeInput />)
      const hiddenInput = container.querySelector(
        'input[aria-label="Verification code"]',
      ) as HTMLInputElement

      fireEvent.change(hiddenInput, { target: { value: 'ABC' } })

      const textElements = container.querySelectorAll('.text-h2')
      expect(textElements[0].textContent).toBe('A')
      expect(textElements[1].textContent).toBe('B')
      expect(textElements[2].textContent).toBe('C')
      expect(textElements[3].textContent).toBe('')
      expect(textElements[4].textContent).toBe('')
      expect(textElements[5].textContent).toBe('')
    })
  })

  describe('length prop', () => {
    it('renders the requested number of boxes (4)', () => {
      const { container } = render(<CodeInput length={4} />)
      const boxes = container.querySelectorAll('.backdrop-blur-md')
      expect(boxes).toHaveLength(4)
    })

    it('renders the requested number of boxes (8)', () => {
      const { container } = render(<CodeInput length={8} />)
      const boxes = container.querySelectorAll('.backdrop-blur-md')
      expect(boxes).toHaveLength(8)
    })

    it('clamps lengths below 4 up to 4', () => {
      const { container } = render(<CodeInput length={2} />)
      const boxes = container.querySelectorAll('.backdrop-blur-md')
      expect(boxes).toHaveLength(4)
    })

    it('clamps lengths above 8 down to 8', () => {
      const { container } = render(<CodeInput length={12} />)
      const boxes = container.querySelectorAll('.backdrop-blur-md')
      expect(boxes).toHaveLength(8)
    })

    it('limits typed input to the configured length', () => {
      const { container } = render(<CodeInput length={4} />)
      const hiddenInput = container.querySelector(
        'input[aria-label="Verification code"]',
      ) as HTMLInputElement
      fireEvent.change(hiddenInput, { target: { value: '1234567890' } })
      expect(hiddenInput.value).toBe('1234')
    })

    it('fires onComplete at the configured length', async () => {
      const onComplete = vi.fn()
      const { container } = render(
        <CodeInput length={4} onComplete={onComplete} />,
      )
      const hiddenInput = container.querySelector(
        'input[aria-label="Verification code"]',
      ) as HTMLInputElement

      fireEvent.change(hiddenInput, { target: { value: '1234' } })
      await new Promise((resolve) => setTimeout(resolve, 10))

      expect(onComplete).toHaveBeenCalledWith('1234')
    })

    it('does not fire onComplete at 6 chars when length is 8', () => {
      const onComplete = vi.fn()
      const { container } = render(
        <CodeInput length={8} onComplete={onComplete} />,
      )
      const hiddenInput = container.querySelector(
        'input[aria-label="Verification code"]',
      ) as HTMLInputElement

      fireEvent.change(hiddenInput, { target: { value: '123456' } })
      expect(onComplete).not.toHaveBeenCalled()
    })
  })
})
