/**
 * @vitest-environment happy-dom
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { act, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSignUpContext } from './context'
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

// Sibling units pull in wallet-react hooks — replace them with stubs so the
// tests exercise the MoreWallets unit against the real root (context, gate).
vi.mock('./Passkey', () => ({ SignUpPasskey: () => null }))
vi.mock('./Google', () => ({ SignUpGoogle: () => null }))
vi.mock('./Email', () => ({ SignUpEmail: () => null }))
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

// The sheet chrome is radix Dialog portaling into the Screen overlay — swap
// it for a plain conditional wrapper so the grid renders without a Screen.
vi.mock('@zerodev/react-ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@zerodev/react-ui')>()
  return {
    ...actual,
    BottomSheet: ({
      open,
      children,
    }: {
      open: boolean
      children: ReactNode
    }) => (open ? <div data-testid="wallet-sheet">{children}</div> : null),
    BottomSheetContent: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
    BottomSheetTitle: () => null,
    BottomSheetClose: ({ children }: { children: ReactNode }) => children,
  }
})

const goToStep = vi.fn()
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ goToStep }),
}))

type FakeConnector = {
  id: string
  uid?: string
  name?: string
  rdns?: string
  type?: string
  icon?: string
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
})

function renderMoreWallets(rootProps?: { termsAndConditionsUrl?: string }) {
  return render(
    <SignUp {...rootProps}>
      <SignUp.MoreWallets />
    </SignUp>,
  )
}

const openSheet = () => {
  fireEvent.click(screen.getByText('More wallets'))
}

describe('SignUp.MoreWallets', () => {
  it('routes guide tiles to the wallet sheet and closes the grid when WalletConnect is configured', () => {
    connectors = [
      { id: 'io.metamask' },
      { id: 'walletConnect', type: 'walletConnect', zdWalletConnect: true },
    ]
    renderMoreWallets()
    openSheet()
    fireEvent.click(screen.getByText('MetaMask'))

    expect(connect).not.toHaveBeenCalled()
    const lastSheet = sheetProps.mock.calls.at(-1)?.[0]
    expect(lastSheet.open).toBe(true)
    expect(lastSheet.wallet?.id).toBe('metamask')
    // The grid closed so the wallet sheet isn't stacked under it.
    expect(screen.queryByTestId('wallet-sheet')).toBeNull()
  })

  it('unmatched connector tiles still connect directly with WalletConnect configured', () => {
    const exotic = {
      id: 'exotic',
      uid: 'exotic-uid',
      name: 'Example Wallet',
      type: 'injected',
    }
    connectors = [
      exotic,
      { id: 'walletConnect', type: 'walletConnect', zdWalletConnect: true },
    ]
    renderMoreWallets()
    openSheet()
    fireEvent.click(screen.getByText('Example Wallet'))
    expect(connect.mock.calls[0][0]).toEqual({ connector: exotic })
  })

  it('opens the grid with every guide wallet and hides non-wallet connectors', () => {
    connectors = [
      { id: 'zerodev-wallet', name: 'ZeroDev' },
      { id: 'wc', name: 'WalletConnect', type: 'walletConnect' },
    ]
    renderMoreWallets()

    expect(screen.queryByTestId('wallet-sheet')).toBeNull()
    openSheet()

    expect(screen.getByTestId('wallet-sheet')).toBeDefined()
    for (const name of ['MetaMask', 'Trust Wallet', 'Binance Wallet']) {
      expect(screen.getByText(name)).toBeDefined()
    }
    expect(screen.queryByText('ZeroDev')).toBeNull()
    expect(screen.queryByText('WalletConnect')).toBeNull()
  })

  it('blocks opening until terms are accepted', () => {
    renderMoreWallets({ termsAndConditionsUrl: 'https://example.com/terms' })

    openSheet()
    expect(screen.queryByTestId('wallet-sheet')).toBeNull()

    fireEvent.click(screen.getByTestId('footer-agree'))
    openSheet()
    expect(screen.getByTestId('wallet-sheet')).toBeDefined()
  })

  it('connects an announced wallet from its tile and closes the flow on success', () => {
    const announced = { id: 'io.metamask' }
    connectors = [announced]
    renderMoreWallets()
    openSheet()

    fireEvent.click(screen.getByText('MetaMask'))
    expect(connect).toHaveBeenCalledTimes(1)
    expect(connect.mock.calls[0][0]).toEqual({ connector: announced })
    // Selecting closes the sheet.
    expect(screen.queryByTestId('wallet-sheet')).toBeNull()

    act(() => connect.mock.calls[0][1].onSuccess())
    expect(goToStep).toHaveBeenCalledWith(null)
  })

  it('opens the download page for a wallet nothing claims', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    renderMoreWallets()
    openSheet()

    fireEvent.click(screen.getByText('MetaMask'))
    expect(openSpy).toHaveBeenCalledWith(
      'https://metamask.io/download',
      '_blank',
      'noopener,noreferrer',
    )
    expect(connect).not.toHaveBeenCalled()
    expect(screen.queryByTestId('wallet-sheet')).toBeNull()
    openSpy.mockRestore()
  })

  it('connects an SDK connector claiming the rdns', () => {
    connectors = [{ id: 'coinbaseWalletSDK', rdns: 'com.coinbase.wallet' }]
    renderMoreWallets()
    openSheet()

    fireEvent.click(screen.getByText('Coinbase Wallet'))
    expect(connect).toHaveBeenCalledTimes(1)
  })

  it('gives unmatched live connectors their own tile', () => {
    const exotic = {
      id: 'com.example.wallet',
      uid: 'u1',
      name: 'Example Wallet',
      type: 'injected',
    }
    connectors = [exotic]
    renderMoreWallets()
    openSheet()

    fireEvent.click(screen.getByText('Example Wallet'))
    expect(connect).toHaveBeenCalledTimes(1)
    expect(connect.mock.calls[0][0]).toEqual({ connector: exotic })
  })

  it('surfaces connect failures through the error takeover, except user rejection', () => {
    connectors = [{ id: 'io.metamask' }]
    renderMoreWallets()

    openSheet()
    fireEvent.click(screen.getByText('MetaMask'))
    const rejection = new Error('User rejected the request.')
    rejection.name = 'UserRejectedRequestError'
    act(() => connect.mock.calls[0][1].onError(rejection))
    expect(screen.queryByText('Error occurred')).toBeNull()

    openSheet()
    fireEvent.click(screen.getByText('MetaMask'))
    act(() => connect.mock.calls[1][1].onError(new Error('boom')))
    expect(screen.getByText('Error occurred')).toBeDefined()
    expect(screen.getByText('boom')).toBeDefined()
  })

  it('reports its in-flight connect so sibling methods disable', () => {
    function AuthPendingReader() {
      const { authPending } = useSignUpContext()
      return <div data-testid="auth-pending">{String(authPending)}</div>
    }

    connectPending = true
    render(
      <SignUp>
        <SignUp.MoreWallets />
        <AuthPendingReader />
      </SignUp>,
    )

    expect(screen.getByTestId('auth-pending').textContent).toBe('true')
    openSheet()
    expect(screen.queryByTestId('wallet-sheet')).toBeNull()
  })
})
