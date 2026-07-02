/**
 * @vitest-environment happy-dom
 */
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthFlow } from './index'
import type { AuthStep } from './types'

afterEach(() => {
  cleanup()
})

// Mock all page components
vi.mock('./pages/SignUp', () => ({
  SignUp: () => <div data-testid="sign-up">SignUp Page</div>,
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

vi.mock('./pages/ErrorScreen', () => ({
  ErrorScreen: () => <div data-testid="error">Error Page</div>,
}))

vi.mock('./pages/WalletSelection', () => ({
  WalletSelection: () => (
    <div data-testid="wallet-selection">WalletSelection Page</div>
  ),
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

// Mock useAuth hook
let mockStep: AuthStep | null = null
vi.mock('./hooks/useAuth', () => ({
  useAuth: () => ({
    step: mockStep,
    email: null,
    otpId: null,
    enabledMethods: ['email', 'google', 'passkey'],
    config: null,
    goToStep: vi.fn(),
    onBack: null,
    reset: vi.fn(),
    setEmail: vi.fn(),
    setOtpId: vi.fn(),
  }),
}))

// Mock useKitLogo — otherwise it calls wagmi's useConfig which needs a provider
vi.mock('../shared/hooks/useKitLogo', () => ({
  useKitLogo: () => null,
}))

describe('AuthFlow', () => {
  it('renders nothing when step is null', () => {
    mockStep = null
    const { container } = render(<AuthFlow />)

    expect(container.firstChild).toBeNull()
  })

  it('renders sign-up page', () => {
    mockStep = 'sign-up'
    render(<AuthFlow />)

    expect(screen.getByTestId('sign-up')).toBeDefined()
    expect(screen.getByText('SignUp Page')).toBeDefined()
  })

  it('renders email-verification page', () => {
    mockStep = 'email-verification'
    render(<AuthFlow />)

    expect(screen.getByTestId('email-verification')).toBeDefined()
    expect(screen.getByText('EmailVerification Page')).toBeDefined()
  })

  it('renders otp-input page', () => {
    mockStep = 'otp-input'
    render(<AuthFlow />)

    expect(screen.getByTestId('otp-input')).toBeDefined()
    expect(screen.getByText('OtpInput Page')).toBeDefined()
  })

  it('renders verifying-otp page', () => {
    mockStep = 'verifying-otp'
    render(<AuthFlow />)

    expect(screen.getByTestId('verifying')).toBeDefined()
    expect(screen.getByText('Verifying Page')).toBeDefined()
  })

  it('renders oauth-in-progress state', () => {
    mockStep = 'oauth-in-progress'
    render(<AuthFlow />)

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
    render(<AuthFlow />)

    expect(screen.getByTestId('status-view')).toBeDefined()
    expect(screen.getByTestId('status-title').textContent).toBe(
      'Passkey authentication',
    )
    expect(screen.getByTestId('status-content').textContent).toBe(
      'Please authenticate with your passkey.',
    )
  })

  it('renders wallet-selection state', () => {
    mockStep = 'wallet-selection'
    render(<AuthFlow />)

    expect(screen.getByTestId('wallet-selection')).toBeDefined()
  })

  it('renders authenticated state as null', () => {
    mockStep = 'authenticated'
    const { container } = render(<AuthFlow />)

    expect(container.firstChild).toBeNull()
  })

  it('renders error page', () => {
    mockStep = 'error'
    render(<AuthFlow />)

    expect(screen.getByTestId('error')).toBeDefined()
    expect(screen.getByText('Error Page')).toBeDefined()
  })

  it('handles unknown step gracefully', () => {
    mockStep = 'unknown-step' as AuthStep
    const { container } = render(<AuthFlow />)

    expect(container.firstChild).toBeNull()
  })
})
