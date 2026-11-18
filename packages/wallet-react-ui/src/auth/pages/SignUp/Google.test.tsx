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

const { authenticateOAuth } = vi.hoisted(() => ({
  authenticateOAuth: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@zerodev/wallet-react', () => ({
  useAuthenticateOAuth: () => ({
    mutateAsync: authenticateOAuth,
    isPending: false,
  }),
}))

const { connections } = vi.hoisted(() => ({
  connections: [] as { connector: { id: string } }[],
}))
vi.mock('wagmi', () => ({
  useConnections: () => connections,
}))

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ goToStep: vi.fn() }),
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

describe('SignUpGoogle while the embedded wallet is signed in', () => {
  afterEach(() => {
    connections.length = 0
  })

  it('renders nothing, so the sheet cannot start a second login', () => {
    connections.push({ connector: { id: 'zerodev-wallet' } })
    render(
      <SignUp>
        <SignUp.Google />
      </SignUp>,
    )
    expect(screen.queryByText('Google')).toBeNull()
  })

  it('renders with an external wallet connected', () => {
    connections.push({ connector: { id: 'io.metamask' } })
    render(
      <SignUp>
        <SignUp.Google />
      </SignUp>,
    )
    expect(screen.queryByText('Google')).not.toBeNull()
  })
})
