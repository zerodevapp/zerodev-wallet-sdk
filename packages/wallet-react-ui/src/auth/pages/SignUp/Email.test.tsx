/**
 * @vitest-environment happy-dom
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SignUp } from './index'

afterEach(cleanup)

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

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    goToStep: vi.fn(),
    setEmail: vi.fn(),
    setOtpSession: vi.fn(),
  }),
}))

vi.mock('../../components/BlobAnimation', () => ({
  BlobAnimation: () => null,
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
