/**
 * @vitest-environment happy-dom
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useReportPending, useSignUpContext } from './context'
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
const startWalletConnect = vi.fn()
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ goToStep, startWalletConnect }),
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

let connectors: FakeConnector[] = []
vi.mock('wagmi', () => ({
  useConnectors: () => connectors,
}))

beforeEach(() => {
  vi.clearAllMocks()
  connectors = []
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
  it('connects an announced guide tile directly even when WalletConnect is configured', () => {
    const metamask = { id: 'io.metamask', uid: 'mm' }
    connectors = [
      metamask,
      { id: 'walletConnect', type: 'walletConnect', zdWalletConnect: true },
    ]
    renderMoreWallets()
    openSheet()
    fireEvent.click(screen.getByText('MetaMask'))

    // The wallet is live on this page — direct connect, no WC handoff.
    expect(startWalletConnect).toHaveBeenCalledTimes(1)
    expect(startWalletConnect.mock.calls[0][0]).toMatchObject({
      connectorUid: metamask.uid,
    })
    expect(screen.queryByTestId('wallet-sheet')).toBeNull()
  })

  it('routes non-announced guide tiles to the wallet sheet and closes the grid when WalletConnect is configured', () => {
    connectors = [
      { id: 'walletConnect', type: 'walletConnect', zdWalletConnect: true },
    ]
    renderMoreWallets()
    openSheet()
    fireEvent.click(screen.getByText('MetaMask'))

    expect(startWalletConnect).not.toHaveBeenCalled()
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
    expect(startWalletConnect.mock.calls[0][0]).toMatchObject({
      connectorUid: exotic.uid,
    })
  })

  it('shows a WalletConnect tile that opens the generic pairing sheet', () => {
    connectors = [
      { id: 'walletConnect', type: 'walletConnect', zdWalletConnect: true },
    ]
    renderMoreWallets()
    openSheet()
    fireEvent.click(screen.getByText('WalletConnect'))

    expect(startWalletConnect).not.toHaveBeenCalled()
    const lastSheet = sheetProps.mock.calls.at(-1)?.[0]
    expect(lastSheet.open).toBe(true)
    expect(lastSheet.wallet).toBeUndefined()
    // The grid closed so the wallet sheet isn't stacked under it.
    expect(screen.queryByTestId('wallet-sheet')).toBeNull()
  })

  it('hides the WalletConnect tile without a zeroDevWalletConnect connector', () => {
    connectors = []
    renderMoreWallets()
    openSheet()
    expect(screen.queryByText('WalletConnect')).toBeNull()
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

  it('connects an announced wallet from its tile into the connecting step', () => {
    const announced = { id: 'io.metamask', uid: 'mm' }
    connectors = [announced]
    renderMoreWallets()
    openSheet()

    fireEvent.click(screen.getByText('MetaMask'))
    expect(startWalletConnect).toHaveBeenCalledTimes(1)
    expect(startWalletConnect.mock.calls[0][0]).toMatchObject({
      connectorUid: announced.uid,
    })
    // Selecting closes the sheet.
    expect(screen.queryByTestId('wallet-sheet')).toBeNull()
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
    expect(startWalletConnect).not.toHaveBeenCalled()
    expect(screen.queryByTestId('wallet-sheet')).toBeNull()
    openSpy.mockRestore()
  })

  it('connects an SDK connector claiming the rdns', () => {
    connectors = [{ id: 'coinbaseWalletSDK', rdns: 'com.coinbase.wallet' }]
    renderMoreWallets()
    openSheet()

    fireEvent.click(screen.getByText('Coinbase Wallet'))
    expect(startWalletConnect).toHaveBeenCalledTimes(1)
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
    expect(startWalletConnect).toHaveBeenCalledTimes(1)
    expect(startWalletConnect.mock.calls[0][0]).toMatchObject({
      connectorUid: exotic.uid,
    })
  })

  it('stays disabled while a sibling method is in flight', () => {
    function AuthPendingReader() {
      const { authPending } = useSignUpContext()
      return <div data-testid="auth-pending">{String(authPending)}</div>
    }
    function SiblingPending() {
      useReportPending(true)
      return null
    }

    render(
      <SignUp>
        <SignUp.MoreWallets />
        <SiblingPending />
        <AuthPendingReader />
      </SignUp>,
    )

    expect(screen.getByTestId('auth-pending').textContent).toBe('true')
    openSheet()
    expect(screen.queryByTestId('wallet-sheet')).toBeNull()
  })
})
