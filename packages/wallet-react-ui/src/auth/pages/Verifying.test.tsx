/**
 * @vitest-environment happy-dom
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Verifying } from './Verifying'

afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', '/')
})

const verifyMagicLink = vi.fn()
vi.mock('@zerodev/wallet-react', () => ({
  useVerifyMagicLink: () => ({ mutate: verifyMagicLink, isPending: false }),
}))

vi.mock('@zerodev/react-ui', () => ({
  Button: ({ text, onClick }: { text: string; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
  PoweredBy: () => null,
}))

vi.mock('../../shared/components/StatusScreen', () => ({
  StatusScreen: ({
    title,
    children,
  }: {
    title: string
    children: ReactNode
  }) => (
    <div>
      <div data-testid="status-title">{title}</div>
      <div data-testid="status-content">{children}</div>
    </div>
  ),
}))

// Mocked narrowly: `Verifying` only reads these four members. Typed as a Pick
// of the real hook so renames of the used fields fail the typecheck.
const goToStep = vi.fn()
const clearOtpSession = vi.fn()
let mockOtpId: string | null = null
let mockBundle: string | null = null
type UsedAuth = Pick<
  ReturnType<typeof import('../hooks/useAuth')['useAuth']>,
  'otpId' | 'otpEncryptionTargetBundle' | 'goToStep' | 'clearOtpSession'
>
vi.mock('../hooks/useAuth', () => ({
  useAuth: (): UsedAuth => ({
    otpId: mockOtpId,
    otpEncryptionTargetBundle: mockBundle,
    goToStep,
    clearOtpSession,
  }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockOtpId = null
  mockBundle = null
  // The component reads the code from the URL once, on mount.
  window.history.replaceState(null, '', '/?code=magic-code-123')
})

describe('Verifying', () => {
  it('shows Link Expired and skips verification when no OTP session is stored', () => {
    render(<Verifying />)

    expect(screen.getByText('Link Expired')).toBeDefined()
    expect(verifyMagicLink).not.toHaveBeenCalled()
    // The invalid-link branch must stay out: a code IS present, it just
    // has no session to verify against.
    expect(screen.queryByText('Invalid Link')).toBeNull()
  })

  it('recovers from the expired link: strips the code and returns to sign-up', () => {
    render(<Verifying />)

    fireEvent.click(screen.getByText('Choose another sign-in method'))

    expect(goToStep).toHaveBeenCalledWith('sign-up')
    // The code must leave the URL, or re-renders would re-enter this screen.
    expect(new URLSearchParams(window.location.search).has('code')).toBe(false)
  })

  it('verifies the code when an OTP session is present', () => {
    mockOtpId = 'otp-live'
    mockBundle = 'bundle-live'

    render(<Verifying />)

    expect(verifyMagicLink).toHaveBeenCalledTimes(1)
    expect(verifyMagicLink).toHaveBeenCalledWith({
      otpId: 'otp-live',
      code: 'magic-code-123',
      otpEncryptionTargetBundle: 'bundle-live',
    })
    expect(screen.queryByText('Link Expired')).toBeNull()
  })
})
