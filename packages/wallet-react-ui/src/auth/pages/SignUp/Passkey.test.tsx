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
    expiresAt: null,
    error: null,
    retry: () => {},
    deepLinkFor: () => null,
  }),
}))

const { registerPasskey, loginPasskey } = vi.hoisted(() => ({
  registerPasskey: vi.fn(),
  loginPasskey: vi.fn(),
}))

vi.mock('@zerodev/wallet-react', () => ({
  useRegisterPasskey: () => ({ mutate: registerPasskey, isPending: false }),
  useLoginPasskey: () => ({ mutate: loginPasskey, isPending: false }),
}))

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ goToStep: vi.fn() }),
}))

vi.mock('../../components/BlobAnimation', () => ({
  BlobAnimation: () => null,
}))

describe('SignUpPasskey terms gate', () => {
  it('blocks both passkey actions until terms are accepted', () => {
    render(
      <SignUp termsAndConditionsUrl="https://example.com/terms">
        <SignUp.Passkey />
      </SignUp>,
    )

    fireEvent.click(screen.getByText('Create a passkey'))
    fireEvent.click(screen.getByText('Log in with passkey'))
    expect(registerPasskey).not.toHaveBeenCalled()
    expect(loginPasskey).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByText('Create a passkey'))
    expect(registerPasskey).toHaveBeenCalledOnce()
  })
})
