/**
 * @vitest-environment happy-dom
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SignUp } from './index'

afterEach(cleanup)

// The SignUp root preloads the page-level pairing — inert here.
vi.mock('../../hooks/useWalletConnectPairing', () => ({
  useWalletConnectPairing: () => ({
    uri: null,
    error: null,
    retry: () => {},
    deepLinkFor: () => null,
  }),
}))
vi.mock('../../../solana/hooks/useSolanaAutoReconnect', () => ({
  useSolanaAutoReconnect: () => {},
}))
vi.mock('../../hooks/useSolanaWalletConnectPairing', () => ({
  useSolanaWalletConnectPairing: () => ({
    uri: null,
    error: null,
    retry: () => {},
    deepLinkFor: () => null,
  }),
}))

const { sendMagicLink, sendOtp } = vi.hoisted(() => ({
  sendMagicLink: vi.fn().mockResolvedValue({
    otpId: 'otp-1',
    otpEncryptionTargetBundle: 'bundle-1',
  }),
  sendOtp: vi.fn().mockResolvedValue({
    otpId: 'otp-1',
    otpEncryptionTargetBundle: 'bundle-1',
  }),
}))

vi.mock('@zerodev/wallet-react', () => ({
  useSendOTP: () => ({ mutateAsync: sendOtp, isPending: false }),
  useSendMagicLink: () => ({ mutateAsync: sendMagicLink, isPending: false }),
}))

const { connections } = vi.hoisted(() => ({
  connections: [] as { connector: { id: string } }[],
}))
vi.mock('wagmi', () => ({
  useConnections: () => connections,
}))

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    goToStep: vi.fn(),
    setEmail: vi.fn(),
    setOtpSession: vi.fn(),
  }),
}))

describe('SignUpEmail terms gate', () => {
  it('blocks the send until terms are accepted', () => {
    render(
      <SignUp termsAndConditionsUrl="https://example.com/terms">
        <SignUp.Email />
      </SignUp>,
    )

    const input = screen.getByPlaceholderText('Enter your email')
    fireEvent.change(input, { target: { value: 'user@example.com' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(sendMagicLink).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(sendMagicLink).toHaveBeenCalledOnce()
  })
})

describe('SignUpEmail while the embedded wallet is signed in', () => {
  afterEach(() => {
    connections.length = 0
  })

  it('renders nothing, so the sheet cannot start a second login', () => {
    connections.push({ connector: { id: 'zerodev-wallet' } })
    render(
      <SignUp>
        <SignUp.Email />
      </SignUp>,
    )
    expect(screen.queryByPlaceholderText('Enter your email')).toBeNull()
  })

  it('renders with an external wallet connected', () => {
    connections.push({ connector: { id: 'io.metamask' } })
    render(
      <SignUp>
        <SignUp.Email />
      </SignUp>,
    )
    expect(screen.queryByPlaceholderText('Enter your email')).not.toBeNull()
  })
})
