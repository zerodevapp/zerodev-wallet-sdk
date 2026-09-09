/**
 * @vitest-environment happy-dom
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Component, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useReportPending } from './context'
import { SignUp } from './index'

afterEach(cleanup)

// The SignUp root preloads the page-level pairing; `deepLink` drives what the
// root's tap-time redirect sees.
const deepLink = vi.hoisted(() => ({ value: null as string | null }))
vi.mock('../../hooks/useWalletConnectPairing', () => ({
  useWalletConnectPairing: () => ({
    uri: null,
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
const startWalletConnect = vi.fn()
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ goToStep, startWalletConnect }),
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

let connectors: FakeConnector[] = []
vi.mock('wagmi', () => ({
  useConnectors: () => connectors,
}))

beforeEach(() => {
  vi.clearAllMocks()
  connectors = []
  deepLink.value = null
})

describe('SignUp.Wallet', () => {
  it('connects an announced wallet directly even when WalletConnect is configured', () => {
    const announced = { id: 'io.metamask', uid: 'mm' }
    connectors = [
      announced,
      { id: 'walletConnect', type: 'walletConnect', zdWalletConnect: true },
    ]
    render(
      <SignUp>
        <SignUp.Wallet walletId="metamask" />
      </SignUp>,
    )
    expect(screen.getByText('INSTALLED')).toBeDefined()

    // The wallet is live on this page — direct connect, no WC handoff.
    fireEvent.click(screen.getByText('MetaMask'))
    expect(startWalletConnect).toHaveBeenCalledTimes(1)
    expect(startWalletConnect.mock.calls[0][0]).toMatchObject({
      connectorUid: announced.uid,
    })
    const lastSheet = sheetProps.mock.calls.at(-1)?.[0]
    expect(lastSheet.open).toBe(false)
  })

  it('opens the wallet sheet for a non-announced wallet when WalletConnect is configured', () => {
    connectors = [
      { id: 'walletConnect', type: 'walletConnect', zdWalletConnect: true },
    ]
    render(
      <SignUp>
        <SignUp.Wallet walletId="metamask" />
      </SignUp>,
    )
    expect(screen.queryByText('INSTALLED')).toBeNull()

    fireEvent.click(screen.getByText('MetaMask'))
    expect(startWalletConnect).not.toHaveBeenCalled()
    const lastSheet = sheetProps.mock.calls.at(-1)?.[0]
    expect(lastSheet.open).toBe(true)
    expect(lastSheet.wallet?.id).toBe('metamask')
  })

  it("connects the in-app browser's variant-rdns announcement directly", () => {
    // MetaMask's mobile browser announces io.metamask.mobile with the
    // extension's name — claimed by name, badged, no WC handoff.
    const inApp = {
      id: 'io.metamask.mobile',
      uid: 'mm-mobile',
      name: 'MetaMask',
      type: 'injected',
    }
    connectors = [
      inApp,
      { id: 'walletConnect', type: 'walletConnect', zdWalletConnect: true },
    ]
    render(
      <SignUp>
        <SignUp.Wallet walletId="metamask" />
      </SignUp>,
    )
    expect(screen.getByText('INSTALLED')).toBeDefined()

    fireEvent.click(screen.getByText('MetaMask'))
    expect(startWalletConnect).toHaveBeenCalledTimes(1)
    expect(startWalletConnect.mock.calls[0][0]).toMatchObject({
      connectorUid: inApp.uid,
    })
  })

  it('connects the claiming connector into the connecting step', () => {
    const announced = { id: 'io.metamask', uid: 'mm' }
    connectors = [announced]
    render(
      <SignUp>
        <SignUp.Wallet walletId="metamask" />
      </SignUp>,
    )

    // An announcement proves a live extension → INSTALLED badge.
    expect(screen.getByText('INSTALLED')).toBeDefined()

    fireEvent.click(screen.getByText('MetaMask'))
    expect(startWalletConnect).toHaveBeenCalledTimes(1)
    expect(startWalletConnect.mock.calls[0][0]).toMatchObject({
      connectorUid: announced.uid,
    })
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
    expect(startWalletConnect).toHaveBeenCalledTimes(1)
  })

  it('renders a download link when no connector claims the wallet', () => {
    render(
      <SignUp>
        <SignUp.Wallet walletId="metamask" />
      </SignUp>,
    )

    const link = screen.getByText('MetaMask').closest('a')
    expect(link?.getAttribute('href')).toBe('https://metamask.io/download')
    expect(startWalletConnect).not.toHaveBeenCalled()
  })

  it('blocks connect until terms are accepted', () => {
    connectors = [{ id: 'io.metamask' }]
    render(
      <SignUp termsAndConditionsUrl="https://example.com/terms">
        <SignUp.Wallet walletId="metamask" />
      </SignUp>,
    )

    fireEvent.click(screen.getByText('MetaMask'))
    expect(startWalletConnect).not.toHaveBeenCalled()

    fireEvent.click(screen.getByTestId('footer-agree'))
    fireEvent.click(screen.getByText('MetaMask'))
    expect(startWalletConnect).toHaveBeenCalledTimes(1)
  })

  it('stays disabled while a sibling method is in flight', () => {
    // Connecting an external wallet no longer locks the page (that moved to
    // the wallet-connecting step); a sibling's in-flight auth still does.
    function SiblingPending() {
      useReportPending(true)
      return null
    }

    connectors = [{ id: 'io.metamask' }]
    render(
      <SignUp>
        <SignUp.Wallet walletId="metamask" />
        <SiblingPending />
      </SignUp>,
    )

    fireEvent.click(screen.getByText('MetaMask'))
    expect(startWalletConnect).not.toHaveBeenCalled()
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
