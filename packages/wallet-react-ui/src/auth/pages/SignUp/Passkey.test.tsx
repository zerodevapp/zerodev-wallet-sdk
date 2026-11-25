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

const { registerPasskey, loginPasskey } = vi.hoisted(() => ({
  registerPasskey: vi.fn(),
  loginPasskey: vi.fn(),
}))

vi.mock('@zerodev/wallet-react', () => ({
  useRegisterPasskey: () => ({ mutate: registerPasskey, isPending: false }),
  useLoginPasskey: () => ({ mutate: loginPasskey, isPending: false }),
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

describe('SignUpPasskey while the embedded wallet is signed in', () => {
  afterEach(() => {
    connections.length = 0
  })

  it('renders nothing, so the sheet cannot start a second login', () => {
    connections.push({ connector: { id: 'zerodev-wallet' } })
    render(
      <SignUp>
        <SignUp.Passkey />
      </SignUp>,
    )
    expect(screen.queryByText('Create a passkey')).toBeNull()
  })

  it('renders with an external wallet connected', () => {
    connections.push({ connector: { id: 'io.metamask' } })
    render(
      <SignUp>
        <SignUp.Passkey />
      </SignUp>,
    )
    expect(screen.queryByText('Create a passkey')).not.toBeNull()
  })
})
