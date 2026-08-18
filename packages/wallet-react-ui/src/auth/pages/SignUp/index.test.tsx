/**
 * @vitest-environment happy-dom
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useReportPending, useSignUpContext } from './context'
import { SignUp } from './index'

afterEach(cleanup)

// The SignUp root preloads the page-level pairing — inert here.
vi.mock('../../hooks/useWalletConnectPairing', () => ({
  useWalletConnectPairing: () => ({
    uri: null,
    expiresAt: null,
    error: null,
    retry: () => {},
    deepLinkFor: () => null,
  }),
}))

// Units pull in wagmi/wallet-react hooks — replace them with markers so the
// tests exercise only the page logic (composition, registry, guard).
vi.mock('./Passkey', () => ({
  SignUpPasskey: () => <div data-testid="unit-passkey" />,
}))
vi.mock('./Google', () => ({
  SignUpGoogle: () => <div data-testid="unit-google" />,
}))
vi.mock('./Email', () => ({
  SignUpEmail: () => <div data-testid="unit-email" />,
}))
vi.mock('./MoreWallets', () => ({
  SignUpMoreWallets: () => <div data-testid="unit-more-wallets" />,
}))

vi.mock('../../components/BlobAnimation', () => ({
  BlobAnimation: () => null,
}))

vi.mock('../../../shared/components/SignUpFooter', () => ({
  SignUpFooter: ({
    setAgreedToTerms,
    highlight,
    termsAndConditionsUrl,
  }: {
    setAgreedToTerms: (agreed: boolean) => void
    highlight: boolean
    termsAndConditionsUrl?: string | undefined
  }) => (
    <button
      type="button"
      data-testid="footer-agree"
      data-highlight={String(highlight)}
      data-terms-url={termsAndConditionsUrl ?? ''}
      onClick={() => setAgreedToTerms(true)}
    >
      agree
    </button>
  ),
}))

/** True when `a` appears before `b` in the document. */
function isBefore(a: Element, b: Element): boolean {
  return !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)
}

describe('SignUp.Default', () => {
  it('renders all methods in order with a divider after the passkey group', () => {
    render(<SignUp.Default />)

    const passkey = screen.getByTestId('unit-passkey')
    const divider = screen.getByText('or')
    const google = screen.getByTestId('unit-google')
    const email = screen.getByTestId('unit-email')

    expect(isBefore(passkey, divider)).toBe(true)
    expect(isBefore(divider, google)).toBe(true)
    expect(isBefore(google, email)).toBe(true)
    // Wallet units are compose-only — the canonical page has none.
    expect(screen.queryByTestId('unit-more-wallets')).toBeNull()
  })

  it('forwards consent-gate props to the root like a hand-composed <SignUp>', () => {
    render(<SignUp.Default termsAndConditionsUrl="https://example.com/terms" />)

    expect(screen.getByTestId('footer-agree').dataset.termsUrl).toBe(
      'https://example.com/terms',
    )
  })
})

function EmailMethodReader() {
  const { emailAuthMethod } = useSignUpContext()
  return <div data-testid="email-method">{emailAuthMethod}</div>
}

describe('emailAuthMethod resolution', () => {
  it('defaults to magicLink and follows the root prop', () => {
    const { unmount } = render(
      <SignUp>
        <EmailMethodReader />
      </SignUp>,
    )
    expect(screen.getByTestId('email-method').textContent).toBe('magicLink')
    unmount()

    render(
      <SignUp emailAuthMethod="otp">
        <EmailMethodReader />
      </SignUp>,
    )
    expect(screen.getByTestId('email-method').textContent).toBe('otp')
  })
})

function PendingProbe({ pending }: { pending: boolean }) {
  useReportPending(pending)
  return null
}

function AuthPendingReader() {
  const { authPending } = useSignUpContext()
  return <div data-testid="auth-pending">{String(authPending)}</div>
}

describe('SignUp shared state', () => {
  it('propagates a unit’s pending state to siblings and clears on unmount', () => {
    const { rerender } = render(
      <SignUp>
        <PendingProbe pending />
        <AuthPendingReader />
      </SignUp>,
    )
    expect(screen.getByTestId('auth-pending').textContent).toBe('true')

    rerender(
      <SignUp>
        <PendingProbe pending={false} />
        <AuthPendingReader />
      </SignUp>,
    )
    expect(screen.getByTestId('auth-pending').textContent).toBe('false')

    rerender(
      <SignUp>
        <PendingProbe pending />
        <AuthPendingReader />
      </SignUp>,
    )
    expect(screen.getByTestId('auth-pending').textContent).toBe('true')

    // Unmounting a pending unit must not leave the page locked.
    rerender(
      <SignUp>
        <AuthPendingReader />
      </SignUp>,
    )
    expect(screen.getByTestId('auth-pending').textContent).toBe('false')
  })

  it('guardAgreement blocks and highlights until terms are accepted', () => {
    let lastGuardResult: boolean | null = null

    function GuardProbe() {
      const { guardAgreement } = useSignUpContext()
      return (
        <button
          type="button"
          data-testid="guard"
          onClick={() => {
            lastGuardResult = guardAgreement()
          }}
        >
          guard
        </button>
      )
    }

    render(
      <SignUp termsAndConditionsUrl="https://example.com/terms">
        <GuardProbe />
      </SignUp>,
    )

    fireEvent.click(screen.getByTestId('guard'))
    expect(lastGuardResult).toBe(false)
    expect(screen.getByTestId('footer-agree').dataset.highlight).toBe('true')

    fireEvent.click(screen.getByTestId('footer-agree'))
    fireEvent.click(screen.getByTestId('guard'))
    expect(lastGuardResult).toBe(true)
    expect(screen.getByTestId('footer-agree').dataset.highlight).toBe('false')
  })

  it('shows the error takeover and restores content on "Try again"', () => {
    function ErrorProbe() {
      const { setError } = useSignUpContext()
      return (
        <button
          type="button"
          data-testid="fail"
          onClick={() => setError('boom')}
        >
          fail
        </button>
      )
    }

    render(
      <SignUp>
        <ErrorProbe />
      </SignUp>,
    )
    const content = screen.getByText('Continue to your wallet')

    fireEvent.click(screen.getByTestId('fail'))
    expect(screen.getByText('Error occurred')).toBeDefined()
    expect(screen.getByText('boom')).toBeDefined()
    // Content is hidden, not unmounted — unit state survives "Try again".
    expect(content.closest('[class*="zd:hidden"]')).not.toBeNull()

    fireEvent.click(screen.getByText('Try again'))
    expect(screen.queryByText('Error occurred')).toBeNull()
    expect(content.closest('[class*="zd:hidden"]')).toBeNull()
  })
})
