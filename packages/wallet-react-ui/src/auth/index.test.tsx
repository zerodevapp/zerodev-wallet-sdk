/**
 * @vitest-environment happy-dom
 */
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ConnectWallet } from './index'
import type { AuthStep } from './types'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  mockAccount = { isConnected: false }
  mockPendingWallet = null
})

// Mock all page components. ConnectWallet renders `SignUp.Default` by default,
// so the mock needs the compound shape.
vi.mock('./pages/SignUp', () => ({
  SignUp: Object.assign(() => <div data-testid="sign-up">SignUp Page</div>, {
    Default: () => <div data-testid="sign-up">SignUp Page</div>,
  }),
}))

vi.mock('./pages/EmailVerification', () => ({
  EmailVerification: () => (
    <div data-testid="email-verification">EmailVerification Page</div>
  ),
}))

vi.mock('./pages/OtpInput', () => ({
  OtpInput: () => <div data-testid="otp-input">OtpInput Page</div>,
}))

vi.mock('./pages/Verifying', () => ({
  Verifying: () => <div data-testid="verifying">Verifying Page</div>,
}))

vi.mock('./pages/WalletConnecting', () => ({
  WalletConnecting: () => (
    <div data-testid="wallet-connecting">WalletConnecting Page</div>
  ),
}))

vi.mock('./pages/ErrorScreen', () => ({
  ErrorScreen: () => <div data-testid="error">Error Page</div>,
}))

vi.mock('../shared/components/StatusScreen', () => ({
  StatusScreen: ({
    title,
    children,
  }: {
    title: string
    children: React.ReactNode
  }) => (
    <div data-testid="status-view">
      <div data-testid="status-title">{title}</div>
      <div data-testid="status-content">{children}</div>
    </div>
  ),
}))

// ConnectWallet watches wagmi for the late-approval case.
let mockAccount: { isConnected: boolean; connector?: { uid: string } } = {
  isConnected: false,
}
vi.mock('wagmi', () => ({
  useAccount: () => mockAccount,
}))

// Mock useAuth hook. Typed against the real hook so field drift (renamed or
// removed members) fails the typecheck instead of accumulating silently.
let mockStep: AuthStep | null = null
let mockPendingWallet: { connectorUid: string; name: string } | null = null
const goToStep = vi.fn()
const clearPendingWallet = vi.fn()
vi.mock('./hooks/useAuth', () => ({
  useAuth: (): ReturnType<typeof import('./hooks/useAuth')['useAuth']> => ({
    step: mockStep,
    email: null,
    otpId: null,
    otpEncryptionTargetBundle: null,
    goToStep,
    goBack: null,
    reset: vi.fn(),
    setEmail: vi.fn(),
    setOtpSession: vi.fn(),
    clearOtpSession: vi.fn(),
    pendingWallet: mockPendingWallet,
    connectError: null,
    startWalletConnect: vi.fn(),
    setConnectError: vi.fn(),
    clearPendingWallet,
  }),
}))

describe('ConnectWallet', () => {
  it('renders nothing when step is null', () => {
    mockStep = null
    const { container } = render(<ConnectWallet />)

    expect(container.firstChild).toBeNull()
  })

  it('renders sign-up page', () => {
    mockStep = 'sign-up'
    render(<ConnectWallet />)

    expect(screen.getByTestId('sign-up')).toBeDefined()
    expect(screen.getByText('SignUp Page')).toBeDefined()
  })

  it('shows the logo only on the sign-up step', () => {
    mockStep = 'sign-up'
    const { unmount } = render(
      <ConnectWallet logo={<div data-testid="brand-logo" />} />,
    )
    expect(screen.getByTestId('brand-logo')).toBeDefined()
    unmount()

    mockStep = 'otp-input'
    render(<ConnectWallet logo={<div data-testid="brand-logo" />} />)
    expect(screen.queryByTestId('brand-logo')).toBeNull()
  })

  it('renders custom sign-up content via renderSignUp', () => {
    mockStep = 'sign-up'
    render(
      <ConnectWallet
        renderSignUp={() => <div data-testid="custom-sign-up">Custom</div>}
      />,
    )

    expect(screen.getByTestId('custom-sign-up')).toBeDefined()
    expect(screen.queryByTestId('sign-up')).toBeNull()
  })

  it('renders email-verification page', () => {
    mockStep = 'email-verification'
    render(<ConnectWallet />)

    expect(screen.getByTestId('email-verification')).toBeDefined()
    expect(screen.getByText('EmailVerification Page')).toBeDefined()
  })

  it('renders otp-input page', () => {
    mockStep = 'otp-input'
    render(<ConnectWallet />)

    expect(screen.getByTestId('otp-input')).toBeDefined()
    expect(screen.getByText('OtpInput Page')).toBeDefined()
  })

  it('renders verifying-otp page', () => {
    mockStep = 'verifying-otp'
    render(<ConnectWallet />)

    expect(screen.getByTestId('verifying')).toBeDefined()
    expect(screen.getByText('Verifying Page')).toBeDefined()
  })

  describe('late approval after the user cancelled the connecting step', () => {
    it('closes when the wallet the user picked comes up connected', () => {
      // Cancel returned to sign-up; the wallet then approved the still-open
      // request. The connecting page (and its callbacks) are long gone.
      mockStep = 'sign-up'
      mockPendingWallet = { connectorUid: 'mm', name: 'MetaMask' }
      mockAccount = { isConnected: true, connector: { uid: 'mm' } }
      render(<ConnectWallet />)

      expect(clearPendingWallet).toHaveBeenCalledTimes(1)
      expect(goToStep).toHaveBeenCalledWith(null)
    })

    it('leaves the widget alone when some other wallet is connected', () => {
      // A host connected to another wallet that opens sign-up on purpose.
      mockStep = 'sign-up'
      mockPendingWallet = { connectorUid: 'mm', name: 'MetaMask' }
      mockAccount = { isConnected: true, connector: { uid: 'other' } }
      render(<ConnectWallet />)

      expect(clearPendingWallet).not.toHaveBeenCalled()
      expect(goToStep).not.toHaveBeenCalledWith(null)
    })

    it('does nothing once the record is cleared, even with the wallet connected', () => {
      mockStep = 'sign-up'
      mockPendingWallet = null
      mockAccount = { isConnected: true, connector: { uid: 'mm' } }
      render(<ConnectWallet />)

      expect(goToStep).not.toHaveBeenCalledWith(null)
    })
  })

  it('renders wallet-connecting page', () => {
    mockStep = 'wallet-connecting'
    render(<ConnectWallet />)

    expect(screen.getByTestId('wallet-connecting')).toBeDefined()
    expect(screen.getByText('WalletConnecting Page')).toBeDefined()
  })

  it('renders oauth-in-progress state', () => {
    mockStep = 'oauth-in-progress'
    render(<ConnectWallet />)

    expect(screen.getByTestId('status-view')).toBeDefined()
    expect(screen.getByTestId('status-title').textContent).toBe(
      'Authenticating...',
    )
    expect(screen.getByTestId('status-content').textContent).toBe(
      'Please wait while we complete the OAuth authentication.',
    )
  })

  it('renders passkey-prompt state', () => {
    mockStep = 'passkey-prompt'
    render(<ConnectWallet />)

    expect(screen.getByTestId('status-view')).toBeDefined()
    expect(screen.getByTestId('status-title').textContent).toBe(
      'Passkey authentication',
    )
    expect(screen.getByTestId('status-content').textContent).toBe(
      'Please authenticate with your passkey.',
    )
  })

  it('renders authenticated state as null', () => {
    mockStep = 'authenticated'
    const { container } = render(<ConnectWallet />)

    expect(container.firstChild).toBeNull()
  })

  it('renders error page', () => {
    mockStep = 'error'
    render(<ConnectWallet />)

    expect(screen.getByTestId('error')).toBeDefined()
    expect(screen.getByText('Error Page')).toBeDefined()
  })

  it('handles unknown step gracefully', () => {
    mockStep = 'unknown-step' as AuthStep
    const { container } = render(<ConnectWallet />)

    expect(container.firstChild).toBeNull()
  })
})
