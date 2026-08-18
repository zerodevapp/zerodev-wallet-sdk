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

const { authenticateOAuth } = vi.hoisted(() => ({
  authenticateOAuth: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@zerodev/wallet-react', () => ({
  useAuthenticateOAuth: () => ({
    mutateAsync: authenticateOAuth,
    isPending: false,
  }),
}))

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ goToStep: vi.fn() }),
}))

vi.mock('../../components/BlobAnimation', () => ({
  BlobAnimation: () => null,
}))

describe('SignUpGoogle terms gate', () => {
  it('blocks the OAuth attempt until terms are accepted', () => {
    render(
      <SignUp termsAndConditionsUrl="https://example.com/terms">
        <SignUp.Google />
      </SignUp>,
    )

    fireEvent.click(screen.getByText('Google'))
    expect(authenticateOAuth).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByText('Google'))
    expect(authenticateOAuth).toHaveBeenCalledOnce()
  })
})
