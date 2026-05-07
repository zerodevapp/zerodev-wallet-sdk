import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../AppLogo', () => ({
  AppLogo: () => <div data-testid="app-logo">App Logo</div>,
}))

import { SignUpFooter } from './index'

const TERMS_URL = 'https://example.com/terms'
const PRIVACY_URL = 'https://example.com/privacy'

afterEach(() => {
  cleanup()
})

describe('SignUpFooter', () => {
  describe('without legal URLs', () => {
    it('renders only the AppLogo when neither URL is provided', () => {
      render(<SignUpFooter agreedToTerms={false} setAgreedToTerms={vi.fn()} />)

      expect(screen.getByTestId('app-logo')).toBeDefined()
      expect(screen.queryByRole('checkbox')).toBeNull()
      expect(screen.queryByText(/I agree to the/i)).toBeNull()
    })
  })

  describe('with both URLs', () => {
    it('renders checkbox and both links', () => {
      render(
        <SignUpFooter
          agreedToTerms={false}
          setAgreedToTerms={vi.fn()}
          termsAndConditionsUrl={TERMS_URL}
          privacyPolicyUrl={PRIVACY_URL}
        />,
      )

      expect(screen.getByRole('checkbox')).toBeDefined()
      expect(screen.getByText(/I agree to the/i)).toBeDefined()

      const tc = screen.getByText('Terms & Conditions') as HTMLAnchorElement
      const pp = screen.getByText('Privacy Policy') as HTMLAnchorElement
      expect(tc.getAttribute('href')).toBe(TERMS_URL)
      expect(pp.getAttribute('href')).toBe(PRIVACY_URL)
    })

    it('joins the two links with " and "', () => {
      const { container } = render(
        <SignUpFooter
          agreedToTerms={false}
          setAgreedToTerms={vi.fn()}
          termsAndConditionsUrl={TERMS_URL}
          privacyPolicyUrl={PRIVACY_URL}
        />,
      )
      expect(container.textContent).toContain(
        'I agree to the Terms & Conditions and Privacy Policy',
      )
    })
  })

  describe('with only Terms & Conditions URL', () => {
    it('renders checkbox and only T&C link', () => {
      render(
        <SignUpFooter
          agreedToTerms={false}
          setAgreedToTerms={vi.fn()}
          termsAndConditionsUrl={TERMS_URL}
        />,
      )

      expect(screen.getByRole('checkbox')).toBeDefined()
      expect(screen.getByText('Terms & Conditions')).toBeDefined()
      expect(screen.queryByText('Privacy Policy')).toBeNull()
    })
  })

  describe('with only Privacy Policy URL', () => {
    it('renders checkbox and only Privacy link', () => {
      render(
        <SignUpFooter
          agreedToTerms={false}
          setAgreedToTerms={vi.fn()}
          privacyPolicyUrl={PRIVACY_URL}
        />,
      )

      expect(screen.getByRole('checkbox')).toBeDefined()
      expect(screen.getByText('Privacy Policy')).toBeDefined()
      expect(screen.queryByText('Terms & Conditions')).toBeNull()
    })
  })

  describe('checkbox state', () => {
    it('reflects agreedToTerms=false', () => {
      render(
        <SignUpFooter
          agreedToTerms={false}
          setAgreedToTerms={vi.fn()}
          termsAndConditionsUrl={TERMS_URL}
        />,
      )
      expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(
        false,
      )
    })

    it('reflects agreedToTerms=true', () => {
      render(
        <SignUpFooter
          agreedToTerms={true}
          setAgreedToTerms={vi.fn()}
          termsAndConditionsUrl={TERMS_URL}
        />,
      )
      expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(
        true,
      )
    })

    it('calls setAgreedToTerms when toggled', () => {
      const mockSetAgreed = vi.fn()
      render(
        <SignUpFooter
          agreedToTerms={false}
          setAgreedToTerms={mockSetAgreed}
          termsAndConditionsUrl={TERMS_URL}
        />,
      )

      fireEvent.click(screen.getByRole('checkbox'))
      expect(mockSetAgreed).toHaveBeenCalledWith(true)
    })
  })
})
