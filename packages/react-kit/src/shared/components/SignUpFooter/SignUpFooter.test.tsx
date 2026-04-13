import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

// Mock the AppLogo component
vi.mock('../AppLogo', () => ({
  AppLogo: () => <div data-testid="app-logo">App Logo</div>,
}))

import { SignUpFooter } from './index'

afterEach(() => {
  cleanup()
})

describe('SignUpFooter', () => {
  describe('rendering', () => {
    it('renders the checkbox', () => {
      const mockSetAgreed = vi.fn()
      render(
        <SignUpFooter agreedToTerms={false} setAgreedToTerms={mockSetAgreed} />,
      )

      const checkbox = screen.getByRole('checkbox')
      expect(checkbox).toBeDefined()
    })

    it('renders the terms and conditions text', () => {
      const mockSetAgreed = vi.fn()
      render(
        <SignUpFooter agreedToTerms={false} setAgreedToTerms={mockSetAgreed} />,
      )

      expect(screen.getByText(/I agree to the/i)).toBeDefined()
      expect(screen.getByText('Terms & Conditions')).toBeDefined()
      expect(screen.getByText('Privacy Policy')).toBeDefined()
    })

    it('renders the AppLogo', () => {
      const mockSetAgreed = vi.fn()
      render(
        <SignUpFooter agreedToTerms={false} setAgreedToTerms={mockSetAgreed} />,
      )

      expect(screen.getByTestId('app-logo')).toBeDefined()
    })

    it('renders "Powered by:" text', () => {
      const mockSetAgreed = vi.fn()
      render(
        <SignUpFooter agreedToTerms={false} setAgreedToTerms={mockSetAgreed} />,
      )

      expect(screen.getByText('Powered by:')).toBeDefined()
    })
  })

  describe('checkbox state', () => {
    it('renders checkbox as unchecked when agreedToTerms is false', () => {
      const mockSetAgreed = vi.fn()
      render(
        <SignUpFooter agreedToTerms={false} setAgreedToTerms={mockSetAgreed} />,
      )

      const checkbox = screen.getByRole('checkbox') as HTMLInputElement
      expect(checkbox.checked).toBe(false)
    })

    it('renders checkbox as checked when agreedToTerms is true', () => {
      const mockSetAgreed = vi.fn()
      render(
        <SignUpFooter agreedToTerms={true} setAgreedToTerms={mockSetAgreed} />,
      )

      const checkbox = screen.getByRole('checkbox') as HTMLInputElement
      expect(checkbox.checked).toBe(true)
    })

    it('calls setAgreedToTerms with true when checkbox is clicked while unchecked', () => {
      const mockSetAgreed = vi.fn()
      render(
        <SignUpFooter agreedToTerms={false} setAgreedToTerms={mockSetAgreed} />,
      )

      const checkbox = screen.getByRole('checkbox')
      fireEvent.click(checkbox)

      expect(mockSetAgreed).toHaveBeenCalledWith(true)
    })

    it('calls setAgreedToTerms with false when checkbox is clicked while checked', () => {
      const mockSetAgreed = vi.fn()
      render(
        <SignUpFooter agreedToTerms={true} setAgreedToTerms={mockSetAgreed} />,
      )

      const checkbox = screen.getByRole('checkbox')
      fireEvent.click(checkbox)

      expect(mockSetAgreed).toHaveBeenCalledWith(false)
    })
  })

  describe('layout', () => {
    it('renders with correct container classes', () => {
      const mockSetAgreed = vi.fn()
      const { container } = render(
        <SignUpFooter agreedToTerms={false} setAgreedToTerms={mockSetAgreed} />,
      )

      const wrapper = container.firstChild as HTMLElement
      expect(wrapper.className).toContain('flex')
      expect(wrapper.className).toContain('flex-col')
      expect(wrapper.className).toContain('items-center')
      expect(wrapper.className).toContain('gap-5')
    })

    it('renders checkbox row with correct layout classes', () => {
      const mockSetAgreed = vi.fn()
      const { container } = render(
        <SignUpFooter agreedToTerms={false} setAgreedToTerms={mockSetAgreed} />,
      )

      const checkboxRow = container.querySelector('.flex-row')
      expect(checkboxRow).toBeDefined()
      expect(checkboxRow?.className).toContain('items-center')
      expect(checkboxRow?.className).toContain('gap-2')
    })

    it('renders logo section with correct layout', () => {
      const mockSetAgreed = vi.fn()
      const { container } = render(
        <SignUpFooter agreedToTerms={false} setAgreedToTerms={mockSetAgreed} />,
      )

      const logoSection = container.querySelectorAll('.flex-row')[1]
      expect(logoSection).toBeDefined()
      expect(logoSection?.className).toContain('gap-1.5')
    })
  })
})
