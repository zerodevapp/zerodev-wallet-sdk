/**
 * @vitest-environment happy-dom
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

// Sibling units pull in wagmi/wallet-react hooks — replace them with stubs so
// the tests exercise the InstalledWallets unit against the real root.
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
  uid: string
  id: string
  name: string
  type: string
  icon?: string
  /** Set by the zeroDevWalletConnect factory; discovery gates on it. */
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

const announced = (id: string, name = id): FakeConnector => ({
  uid: crypto.randomUUID(),
  id,
  name,
  type: 'injected',
  icon: 'data:image/svg+xml,announced',
})

beforeEach(() => {
  vi.clearAllMocks()
  connectors = []
  connectPending = false
})

describe('SignUp.InstalledWallets', () => {
  it('connects rows directly even when WalletConnect is configured', () => {
    connectors = [
      announced('io.metamask'),
      announced('com.unknown.wallet', 'Unknown'),
      {
        uid: crypto.randomUUID(),
        id: 'walletConnect',
        name: 'WalletConnect',
        type: 'walletConnect',
        zdWalletConnect: true,
      },
    ]
    render(
      <SignUp>
        <SignUp.InstalledWallets />
      </SignUp>,
    )
    // Every row is a live announced provider — direct connect, never the
    // sheet (a WC handoff bounces out of the wallet's own in-app browser).
    fireEvent.click(screen.getByText('MetaMask'))
    expect(connect).toHaveBeenCalledTimes(1)
    const lastSheet = sheetProps.mock.calls.at(-1)?.[0]
    expect(lastSheet.open).toBe(false)

    fireEvent.click(screen.getByText('Unknown'))
    expect(connect).toHaveBeenCalledTimes(2)
  })

  it('renders a badged row per announced connector and nothing else', () => {
    connectors = [
      announced('io.metamask'),
      announced('com.example.unknown', 'Example Wallet'),
      // Configured SDK connector: claims an rdns but proves nothing.
      {
        uid: crypto.randomUUID(),
        id: 'coinbaseWalletSDK',
        name: 'Coinbase Wallet',
        type: 'coinbaseWallet',
      },
      // Generic injected() connector exists regardless of installation.
      {
        uid: crypto.randomUUID(),
        id: 'injected',
        name: 'Injected',
        type: 'injected',
      },
      // The embedded-wallet connector claims type "injected" too — it must
      // be excluded by id. WC transport never belongs in the list either.
      {
        uid: crypto.randomUUID(),
        id: 'zerodev-wallet',
        name: 'ZeroDevWallet',
        type: 'injected',
      },
      {
        uid: crypto.randomUUID(),
        id: 'walletConnect',
        name: 'WalletConnect',
        type: 'walletConnect',
      },
    ]
    render(
      <SignUp>
        <SignUp.InstalledWallets />
      </SignUp>,
    )

    // Guide match is branded from the guide; unknown keeps connector identity.
    expect(screen.getByText('MetaMask')).toBeDefined()
    expect(screen.getByText('Example Wallet')).toBeDefined()
    expect(screen.getAllByText('INSTALLED')).toHaveLength(2)
    expect(screen.queryByText('Coinbase Wallet')).toBeNull()
    expect(screen.queryByText('Injected')).toBeNull()
    expect(screen.queryByText('ZeroDevWallet')).toBeNull()
    expect(screen.queryByText('WalletConnect')).toBeNull()
  })

  it('renders nothing when no wallet is installed', () => {
    connectors = [
      {
        uid: crypto.randomUUID(),
        id: 'injected',
        name: 'Injected',
        type: 'injected',
      },
    ]
    render(
      <SignUp>
        <SignUp.InstalledWallets />
      </SignUp>,
    )
    expect(screen.queryByText('INSTALLED')).toBeNull()
  })

  it('excludes wallets by guide id or rdns', () => {
    connectors = [
      announced('io.metamask'),
      announced('io.rabby'),
      announced('com.example.unknown', 'Example Wallet'),
    ]
    render(
      <SignUp>
        <SignUp.InstalledWallets
          excludeWalletIds={['metamask', 'com.example.unknown']}
        />
      </SignUp>,
    )
    expect(screen.queryByText('MetaMask')).toBeNull()
    expect(screen.queryByText('Example Wallet')).toBeNull()
    expect(screen.getByText('Rabby Wallet')).toBeDefined()
  })

  it('caps rows at maxWallets, dropping unknown extensions before guide ones', () => {
    connectors = [
      announced('com.example.unknown', 'Example Wallet'),
      announced('io.rabby'),
      announced('io.metamask'),
    ]
    render(
      <SignUp>
        <SignUp.InstalledWallets maxWallets={2} />
      </SignUp>,
    )
    // Guide order: metamask before rabby; the unknown extension is cut.
    expect(screen.getByText('MetaMask')).toBeDefined()
    expect(screen.getByText('Rabby Wallet')).toBeDefined()
    expect(screen.queryByText('Example Wallet')).toBeNull()
  })

  it('caps at 4 rows by default', () => {
    connectors = [
      announced('io.metamask'),
      announced('io.rabby'),
      announced('io.zerion.wallet'),
      announced('com.okex.wallet'),
      announced('com.example.unknown', 'Example Wallet'),
    ]
    render(
      <SignUp>
        <SignUp.InstalledWallets />
      </SignUp>,
    )
    expect(screen.getAllByText('INSTALLED')).toHaveLength(4)
    // The unknown extension ranks last and is the one cut.
    expect(screen.queryByText('Example Wallet')).toBeNull()
  })

  it('connects the clicked connector and closes the flow on success', () => {
    const metamask = announced('io.metamask')
    connectors = [metamask, announced('io.rabby')]
    render(
      <SignUp>
        <SignUp.InstalledWallets />
      </SignUp>,
    )

    fireEvent.click(screen.getByText('MetaMask'))
    expect(connect).toHaveBeenCalledTimes(1)
    expect(connect.mock.calls[0][0]).toEqual({ connector: metamask })

    act(() => connect.mock.calls[0][1].onSuccess())
    expect(goToStep).toHaveBeenCalledWith(null)
  })

  it('blocks connect until terms are accepted', () => {
    connectors = [announced('io.metamask')]
    render(
      <SignUp termsAndConditionsUrl="https://example.com/terms">
        <SignUp.InstalledWallets />
      </SignUp>,
    )

    fireEvent.click(screen.getByText('MetaMask'))
    expect(connect).not.toHaveBeenCalled()

    fireEvent.click(screen.getByTestId('footer-agree'))
    fireEvent.click(screen.getByText('MetaMask'))
    expect(connect).toHaveBeenCalledTimes(1)
  })

  it('surfaces connect failures through the error takeover, except user rejection', () => {
    connectors = [announced('io.metamask')]
    render(
      <SignUp>
        <SignUp.InstalledWallets />
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

  it('auto-dedupes a wallet pinned via SignUp.Wallet', () => {
    connectors = [announced('io.metamask'), announced('io.rabby')]
    render(
      <SignUp>
        <SignUp.Wallet walletId="metamask" />
        <SignUp.InstalledWallets />
      </SignUp>,
    )

    // The pinned row is the only MetaMask on the page; discovery still
    // lists the un-pinned wallet.
    expect(screen.getAllByText('MetaMask')).toHaveLength(1)
    expect(screen.getByText('Rabby Wallet')).toBeDefined()
  })

  it('auto-dedupes an in-app browser variant-rdns announcement by name', () => {
    // MetaMask's mobile browser announces io.metamask.mobile — still the
    // pinned wallet, not a second row.
    connectors = [announced('io.metamask.mobile', 'MetaMask')]
    render(
      <SignUp>
        <SignUp.Wallet walletId="metamask" />
        <SignUp.InstalledWallets />
      </SignUp>,
    )

    expect(screen.getAllByText('MetaMask')).toHaveLength(1)
    // And the surviving pinned row connects it, instead of linking out to
    // the download page.
    fireEvent.click(screen.getByText('MetaMask'))
    expect(connect).toHaveBeenCalledTimes(1)
  })

  it('auto-dedupes regardless of unit order', () => {
    connectors = [announced('io.metamask')]
    render(
      <SignUp>
        <SignUp.InstalledWallets />
        <SignUp.Wallet walletId="metamask" />
      </SignUp>,
    )

    expect(screen.getAllByText('MetaMask')).toHaveLength(1)
  })

  it('returns a wallet to discovery when its pin unmounts', () => {
    connectors = [announced('io.metamask')]
    const { rerender } = render(
      <SignUp>
        <SignUp.Wallet walletId="metamask" />
        <SignUp.InstalledWallets />
      </SignUp>,
    )
    expect(screen.getAllByText('MetaMask')).toHaveLength(1)

    rerender(
      <SignUp>
        <SignUp.InstalledWallets />
      </SignUp>,
    )
    // Unregistered on unmount — the discovery row takes over.
    expect(screen.getAllByText('MetaMask')).toHaveLength(1)
  })

  it('composes auto-dedupe with excludeWalletIds', () => {
    connectors = [announced('io.metamask'), announced('io.rabby')]
    render(
      <SignUp>
        <SignUp.Wallet walletId="metamask" />
        <SignUp.InstalledWallets excludeWalletIds={['rabby']} />
      </SignUp>,
    )

    expect(screen.getAllByText('MetaMask')).toHaveLength(1)
    expect(screen.queryByText('Rabby Wallet')).toBeNull()
  })

  it('disables rows while another method is in flight', () => {
    connectors = [announced('io.metamask')]
    connectPending = true
    render(
      <SignUp>
        <SignUp.InstalledWallets />
      </SignUp>,
    )

    fireEvent.click(screen.getByText('MetaMask'))
    expect(connect).not.toHaveBeenCalled()
  })
})
