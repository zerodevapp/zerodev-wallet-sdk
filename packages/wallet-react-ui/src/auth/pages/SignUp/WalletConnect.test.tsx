/**
 * @vitest-environment happy-dom
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
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
// the tests exercise the WalletConnect unit against the real root.
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

// The sheet owns the pairing; the unit only opens it.
const sheetProps = vi.fn()
vi.mock('../../components/WalletSheet', () => ({
  WalletSheet: (props: { open: boolean }) => {
    sheetProps(props)
    return props.open ? <div data-testid="sheet-open" /> : null
  },
}))

const goToStep = vi.fn()
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ goToStep }),
}))

let connectors: unknown[] = []
vi.mock('wagmi', () => ({
  useConnectors: () => connectors,
  useConnect: () => ({ connect: vi.fn(), isPending: false }),
}))

const stampedWc = () => ({
  uid: crypto.randomUUID(),
  id: 'walletConnect',
  type: 'walletConnect',
  zdWalletConnect: true,
})

beforeEach(() => {
  vi.clearAllMocks()
  connectors = []
})

describe('SignUp.WalletConnect', () => {
  it('renders nothing without a zeroDevWalletConnect connector', () => {
    connectors = [{ id: 'walletConnect', type: 'walletConnect' }] // raw, unstamped
    render(
      <SignUp>
        <SignUp.WalletConnect />
      </SignUp>,
    )
    expect(screen.queryByText('WalletConnect')).toBeNull()
  })

  it('renders the badged row and opens the sheet on click', () => {
    connectors = [stampedWc()]
    render(
      <SignUp>
        <SignUp.WalletConnect />
      </SignUp>,
    )
    expect(screen.getByText('QR CODE')).toBeDefined()
    expect(screen.queryByTestId('sheet-open')).toBeNull()

    fireEvent.click(screen.getByText('WalletConnect'))
    expect(screen.getByTestId('sheet-open')).toBeDefined()
  })

  it('blocks the sheet until terms are accepted', () => {
    connectors = [stampedWc()]
    render(
      <SignUp termsAndConditionsUrl="https://zerodev.app/terms">
        <SignUp.WalletConnect />
      </SignUp>,
    )
    fireEvent.click(screen.getByText('WalletConnect'))
    expect(screen.queryByTestId('sheet-open')).toBeNull()

    fireEvent.click(screen.getByTestId('footer-agree'))
    fireEvent.click(screen.getByText('WalletConnect'))
    expect(screen.getByTestId('sheet-open')).toBeDefined()
  })
})
