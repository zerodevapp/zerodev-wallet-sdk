import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CodeInput } from '.'

afterEach(() => {
  cleanup()
})

// Helper: get all digit inputs by aria-label
const getDigits = (length = 6) =>
  Array.from({ length }, (_, i) => screen.getByLabelText(`Digit ${i + 1}`))

describe('CodeInput', () => {
  describe('rendering', () => {
    it('renders 6 inputs by default', () => {
      render(<CodeInput />)
      const digits = getDigits(6)
      expect(digits).toHaveLength(6)
    })

    it('renders the correct number of inputs for a custom length', () => {
      render(<CodeInput length={4} />)
      expect(getDigits(4)).toHaveLength(4)
    })

    it('renders all inputs as empty initially', () => {
      render(<CodeInput />)
      for (const input of getDigits(6)) {
        expect((input as HTMLInputElement).value).toBe('')
      }
    })

    it('renders inputs with type="text"', () => {
      render(<CodeInput />)
      for (const input of getDigits(6)) {
        expect((input as HTMLInputElement).type).toBe('text')
      }
    })

    it('renders with data-testid on the wrapper', () => {
      render(<CodeInput data-testid="otp" />)
      expect(screen.getByTestId('otp')).toBeDefined()
    })

    it('renders per-digit data-testid when data-testid is provided', () => {
      render(<CodeInput data-testid="otp" length={4} />)
      for (let i = 0; i < 4; i++) {
        expect(screen.getByTestId(`otp-${i}`)).toBeDefined()
      }
    })
  })

  describe('typing', () => {
    it('accepts a digit in the first box', () => {
      render(<CodeInput />)
      const [first] = getDigits()
      fireEvent.change(first, { target: { value: '3' } })
      expect((first as HTMLInputElement).value).toBe('3')
    })

    it('ignores non-numeric characters', () => {
      render(<CodeInput />)
      const [first] = getDigits()
      fireEvent.change(first, { target: { value: 'a' } })
      expect((first as HTMLInputElement).value).toBe('')
    })

    it('calls onChange with the current code string after each keystroke', () => {
      const onChange = vi.fn()
      render(<CodeInput onChange={onChange} />)
      const [first] = getDigits()
      fireEvent.change(first, { target: { value: '5' } })
      expect(onChange).toHaveBeenCalledWith(
        '5     '.trimEnd().padEnd(6, ' ').replace(/ /g, ''),
      )
      // The code string is the joined values – 6 chars, only first filled
      expect(onChange).toHaveBeenCalledWith(expect.stringMatching(/^5/))
    })

    it('advances focus to the next input after a digit is entered', () => {
      render(<CodeInput />)
      const [first, second] = getDigits()
      first.focus()
      fireEvent.change(first, { target: { value: '1' } })
      expect(document.activeElement).toBe(second)
    })

    it('does not advance focus past the last input', () => {
      render(<CodeInput length={2} />)
      const [, second] = getDigits(2)
      second.focus()
      fireEvent.change(second, { target: { value: '9' } })
      expect(document.activeElement).toBe(second)
    })
  })

  describe('onComplete', () => {
    it('calls onComplete when all digits are filled', () => {
      const onComplete = vi.fn()
      render(<CodeInput length={4} onComplete={onComplete} data-testid="otp" />)
      const digits = getDigits(4)
      fireEvent.change(digits[0], { target: { value: '1' } })
      fireEvent.change(digits[1], { target: { value: '2' } })
      fireEvent.change(digits[2], { target: { value: '3' } })
      fireEvent.change(digits[3], { target: { value: '4' } })
      expect(onComplete).toHaveBeenCalledOnce()
      expect(onComplete).toHaveBeenCalledWith('1234')
    })

    it('does not call onComplete when only some digits are filled', () => {
      const onComplete = vi.fn()
      render(<CodeInput length={4} onComplete={onComplete} />)
      const digits = getDigits(4)
      fireEvent.change(digits[0], { target: { value: '1' } })
      fireEvent.change(digits[1], { target: { value: '2' } })
      expect(onComplete).not.toHaveBeenCalled()
    })
  })

  describe('backspace', () => {
    it('clears the current box on Backspace when it has a value', () => {
      render(<CodeInput />)
      const [first] = getDigits()
      fireEvent.change(first, { target: { value: '7' } })
      fireEvent.keyDown(first, { key: 'Backspace' })
      expect((first as HTMLInputElement).value).toBe('')
    })

    it('moves focus to the previous box on Backspace when current box is empty', () => {
      render(<CodeInput length={3} />)
      const [first, second] = getDigits(3)
      fireEvent.change(first, { target: { value: '1' } })
      second.focus()
      fireEvent.keyDown(second, { key: 'Backspace' })
      expect(document.activeElement).toBe(first)
    })

    it('does not move focus before the first box on Backspace', () => {
      render(<CodeInput />)
      const [first] = getDigits()
      first.focus()
      fireEvent.keyDown(first, { key: 'Backspace' })
      expect(document.activeElement).toBe(first)
    })
  })

  describe('arrow keys', () => {
    it('moves focus left on ArrowLeft', () => {
      render(<CodeInput length={3} />)
      const [first, second] = getDigits(3)
      second.focus()
      fireEvent.keyDown(second, { key: 'ArrowLeft' })
      expect(document.activeElement).toBe(first)
    })

    it('moves focus right on ArrowRight', () => {
      render(<CodeInput length={3} />)
      const [first, second] = getDigits(3)
      first.focus()
      fireEvent.keyDown(first, { key: 'ArrowRight' })
      expect(document.activeElement).toBe(second)
    })
  })

  describe('paste', () => {
    const createPasteEvent = (text: string) => ({
      clipboardData: { getData: () => text },
      preventDefault: vi.fn(),
    })

    it('fills all boxes when a full numeric code is pasted', () => {
      const onChange = vi.fn()
      render(<CodeInput length={4} onChange={onChange} />)
      const [first] = getDigits(4)
      fireEvent.paste(first, createPasteEvent('1234'))
      const digits = getDigits(4)
      expect((digits[0] as HTMLInputElement).value).toBe('1')
      expect((digits[1] as HTMLInputElement).value).toBe('2')
      expect((digits[2] as HTMLInputElement).value).toBe('3')
      expect((digits[3] as HTMLInputElement).value).toBe('4')
    })

    it('calls onComplete when a full code is pasted', () => {
      const onComplete = vi.fn()
      render(<CodeInput length={4} onComplete={onComplete} />)
      const [first] = getDigits(4)
      fireEvent.paste(first, createPasteEvent('5678'))
      expect(onComplete).toHaveBeenCalledWith('5678')
    })

    it('strips non-numeric characters from pasted text', () => {
      const onChange = vi.fn()
      render(<CodeInput length={4} onChange={onChange} />)
      const [first] = getDigits(4)
      fireEvent.paste(first, createPasteEvent('12-34'))
      expect(onChange).toHaveBeenCalledWith('1234')
    })

    it('truncates pasted text to the code length', () => {
      const onChange = vi.fn()
      render(<CodeInput length={4} onChange={onChange} />)
      const [first] = getDigits(4)
      fireEvent.paste(first, createPasteEvent('123456789'))
      expect(onChange).toHaveBeenCalledWith('1234')
    })

    it('does nothing when pasted text contains no digits', () => {
      const onChange = vi.fn()
      render(<CodeInput length={4} onChange={onChange} />)
      const [first] = getDigits(4)
      fireEvent.paste(first, createPasteEvent('abcd'))
      expect(onChange).not.toHaveBeenCalled()
    })
  })

  describe('disabled state', () => {
    it('disables all inputs when disabled=true', () => {
      render(<CodeInput disabled />)
      for (const input of getDigits()) {
        expect((input as HTMLInputElement).disabled).toBe(true)
      }
    })

    it('applies disabled styling classes', () => {
      render(<CodeInput disabled />)
      for (const input of getDigits()) {
        expect((input as HTMLInputElement).className).toContain('opacity-50')
        expect((input as HTMLInputElement).className).toContain(
          'cursor-not-allowed',
        )
      }
    })

    it('does not apply disabled classes when not disabled', () => {
      render(<CodeInput />)
      for (const input of getDigits()) {
        expect((input as HTMLInputElement).className).not.toContain(
          'opacity-50',
        )
      }
    })
  })

  describe('error state', () => {
    it('applies error border classes when error=true', () => {
      render(<CodeInput error />)
      for (const input of getDigits()) {
        expect((input as HTMLInputElement).className).toContain(
          'border-red-500',
        )
      }
    })

    it('applies normal border classes when error=false', () => {
      render(<CodeInput />)
      for (const input of getDigits()) {
        expect((input as HTMLInputElement).className).toContain(
          'border-gray-200',
        )
      }
    })
  })
})
