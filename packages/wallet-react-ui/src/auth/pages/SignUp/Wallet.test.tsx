/**
 * @vitest-environment happy-dom
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { act, Component, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSignUpContext } from './context'
import { SignUp } from './index'

afterEach(cleanup)

// The SignUp root preloads the page-level pairing; `deepLink` drives what the
// root's tap-time redirect sees.
const deepLink = vi.hoisted(() => ({ value: null as string | null }))
vi.mock('../../hooks/useWalletConnectPairing', () => ({
  useWalletConnectPairing: () => ({
    uri: null,
    expiresAt: null,
    error: null,
    retry: () => {},
    deepLinkFor: () => deepLink.value,
  }),
}))

// Sibling units pull in wagmi/wallet-react hooks — replace them with stubs so
// the tests exercise the Wallet unit against the real root (context, gate).
vi.mock('./Passkey', () => ({ SignUpPasskey: () => null }))
vi.mock('./Google', () => ({ SignUpGoogle: () => null }))
vi.mock('./Email', () => ({ SignUpEmail: () => null }))
vi.mock('./MoreWallets', () => ({ SignUpMoreWallets: () => null }))
vi.mock('../../components/BlobAnimation', () => ({
  BlobAnimation: () => null,
}))
vi.mock('../../../shared/components/SignUpFooter', () => ({
  SignUpFooter: ({
    setAgreedToTerms,
  }: {
    setAgreedToTerms: (agreed: boolean) => void
  }) => (
    <button
      type="button"
      data-testid="footer-agree"
      onClick={() => setAgreedToTerms(true)}
    >
      agree
    </button>
  ),
}))

const goToStep = vi.fn()
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ goToStep }),
}))

type FakeConnector = {
  id: string
  rdns?: string
  type?: string
  zdWalletConnect?: boolean
}
// The root renders the single WalletSheet; probe its props instead of
// pulling radix + the pairing hook into these tests.
const sheetProps = vi.fn()
vi.mock('../../components/WalletSheet', () => ({
  WalletSheet: (props: { open: boolean }) => {
    sheetProps(props)
    return null
  },
}))

const connect = vi.fn()
let connectors: FakeConnector[] = []
let connectPending = false
vi.mock('wagmi', () => ({
  useConnectors: () => connectors,
  useConnect: () => ({ mutate: connect, isPending: connectPending }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  connectors = []
  connectPending = false
  deepLink.value = null
})

describe('SignUp.Wallet', () => {
  it('opens the wallet sheet instead of connecting when WalletConnect is configured', () => {
    const announced = { id: 'io.metamask' }
    connectors = [
      announced,
      { id: 'walletConnect', type: 'walletConnect', zdWalletConnect: true },
    ]
    render(
      <SignUp>
        <SignUp.Wallet walletId="metamask" />
      </SignUp>,
    )
    // Still badged — the sheet hub doesn't change the claim rules.
    expect(screen.getByText('INSTALLED')).toBeDefined()

    fireEvent.click(screen.getByText('MetaMask'))
    expect(connect).not.toHaveBeenCalled()
    const lastSheet = sheetProps.mock.calls.at(-1)?.[0]
    expect(lastSheet.open).toBe(true)
    expect(lastSheet.wallet?.id).toBe('metamask')
  })

  it('connects the claiming connector and closes the flow on success', () => {
    const announced = { id: 'io.metamask' }
    connectors = [announced]
    render(
      <SignUp>
        <SignUp.Wallet walletId="metamask" />
      </SignUp>,
    )

    // An announcement proves a live extension → INSTALLED badge.
    expect(screen.getByText('INSTALLED')).toBeDefined()

    fireEvent.click(screen.getByText('MetaMask'))
    expect(connect).toHaveBeenCalledTimes(1)
    expect(connect.mock.calls[0][0]).toEqual({ connector: announced })

    act(() => connect.mock.calls[0][1].onSuccess())
    expect(goToStep).toHaveBeenCalledWith(null)
  })

  it('treats a configured SDK connector claiming the rdns as connectable, without a badge', () => {
    connectors = [{ id: 'coinbaseWalletSDK', rdns: 'com.coinbase.wallet' }]
    render(
      <SignUp>
        <SignUp.Wallet walletId="coinbase" />
      </SignUp>,
    )

    // Configured connectors exist regardless of installation — no badge.
    expect(screen.queryByText('INSTALLED')).toBeNull()

    fireEvent.click(screen.getByText('Coinbase Wallet'))
    expect(connect).toHaveBeenCalledTimes(1)
  })

  it('renders a download link when no connector claims the wallet', () => {
    render(
      <SignUp>
        <SignUp.Wallet walletId="metamask" />
      </SignUp>,
    )

    const link = screen.getByText('MetaMask').closest('a')
    expect(link?.getAttribute('href')).toBe('https://metamask.io/download')
    expect(connect).not.toHaveBeenCalled()
  })

  it('blocks connect until terms are accepted', () => {
    connectors = [{ id: 'io.metamask' }]
    render(
      <SignUp termsAndConditionsUrl="https://example.com/terms">
        <SignUp.Wallet walletId="metamask" />
      </SignUp>,
    )

    fireEvent.click(screen.getByText('MetaMask'))
    expect(connect).not.toHaveBeenCalled()

    fireEvent.click(screen.getByTestId('footer-agree'))
    fireEvent.click(screen.getByText('MetaMask'))
    expect(connect).toHaveBeenCalledTimes(1)
  })

  it('reports its in-flight connect so sibling methods disable', () => {
    function AuthPendingReader() {
      const { authPending } = useSignUpContext()
      return <div data-testid="auth-pending">{String(authPending)}</div>
    }

    connectors = [{ id: 'io.metamask' }]
    connectPending = true
    render(
      <SignUp>
        <SignUp.Wallet walletId="metamask" />
        <AuthPendingReader />
      </SignUp>,
    )

    expect(screen.getByTestId('auth-pending').textContent).toBe('true')
    fireEvent.click(screen.getByText('MetaMask'))
    expect(connect).not.toHaveBeenCalled()
  })

  it('surfaces connect failures through the error takeover, except user rejection', () => {
    connectors = [{ id: 'io.metamask' }]
    render(
      <SignUp>
        <SignUp.Wallet walletId="metamask" />
      </SignUp>,
    )

    fireEvent.click(screen.getByText('MetaMask'))
    const rejection = new Error('User rejected the request.')
    rejection.name = 'UserRejectedRequestError'
    act(() => connect.mock.calls[0][1].onError(rejection))
    expect(screen.queryByText('Error occurred')).toBeNull()

    fireEvent.click(screen.getByText('MetaMask'))
    act(() => connect.mock.calls[1][1].onError(new Error('boom')))
    expect(screen.getByText('Error occurred')).toBeDefined()
    expect(screen.getByText('boom')).toBeDefined()
  })

  it('throws on an unknown walletId (raw-JS guard)', () => {
    class Catcher extends Component<
      { children: ReactNode },
      { message: string | null }
    > {
      override state = { message: null as string | null }
      static getDerivedStateFromError(err: Error) {
        return { message: err.message }
      }
      override render() {
        return this.state.message ? (
          <div data-testid="caught">{this.state.message}</div>
        ) : (
          this.props.children
        )
      }
    }

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <Catcher>
        <SignUp>
          <SignUp.Wallet walletId={'nope' as never} />
        </SignUp>
      </Catcher>,
    )
    expect(screen.getByTestId('caught').textContent).toMatch(
      /Unknown walletId "nope"/,
    )
    consoleError.mockRestore()
  })

  it('fires the mobile deep link on the row tap and still opens the sheet', () => {
    connectors = [
      { id: 'walletConnect', type: 'walletConnect', zdWalletConnect: true },
    ]
    deepLink.value = 'https://metamask.app.link/wc?uri=wc%3Aabc%402'
    render(
      <SignUp>
        <SignUp.Wallet walletId="metamask" />
      </SignUp>,
    )

    fireEvent.click(screen.getByText('MetaMask'))
    expect(window.location.href).toBe(
      'https://metamask.app.link/wc?uri=wc%3Aabc%402',
    )
    // The sheet still opens behind the redirect as the fallback surface.
    const lastSheet = sheetProps.mock.calls.at(-1)?.[0]
    expect(lastSheet.open).toBe(true)
  })
})
