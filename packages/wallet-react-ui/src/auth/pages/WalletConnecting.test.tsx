/**
 * @vitest-environment happy-dom
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { type ReactNode, StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createStore } from '../../store'
import { WalletConnecting } from './WalletConnecting'

afterEach(cleanup)

vi.mock('../../shared/components/StatusScreen', () => ({
  StatusScreen: ({
    title,
    children,
  }: {
    title: string
    children: ReactNode
  }) => (
    <div>
      <div data-testid="title">{title}</div>
      <div data-testid="body">{children}</div>
    </div>
  ),
}))

// A real kit store behind useAuth (useKitStore reads it off the wagmi config),
// so step transitions are asserted on real state.
let store = createStore()
/** Deferred for the in-flight @wagmi/core connect(); one per attempt. */
let settle: { resolve: () => void; reject: (err: unknown) => void }
const connect = vi.fn(
  (..._args: unknown[]) =>
    new Promise<void>((resolve, reject) => {
      settle = { resolve: () => resolve(), reject }
    }),
)
type FakeConnector = { uid: string; name: string; icon?: string }
let connectors: FakeConnector[] = []
// Fresh per test, like a fresh page load: the page keeps its in-flight
// attempt keyed by the wagmi config, and that must not leak between tests.
function makeFakeConfig() {
  return {
    connectors: [{ id: 'zerodev-wallet', getKitStore: () => store }],
    state: { connections: new Map<string, { connector: FakeConnector }>() },
  }
}
let fakeConfig = makeFakeConfig()
vi.mock('wagmi', () => ({
  useConfig: () => fakeConfig,
  useConnectors: () => connectors,
}))
vi.mock('@wagmi/core', () => ({
  connect: (...args: unknown[]) => connect(...args),
}))

const metamask: FakeConnector = { uid: 'mm', name: 'MetaMask', icon: 'data:mm' }
const auth = () => store.getState().auth
const approve = () =>
  act(async () => {
    settle.resolve()
  })
const rejectWith = (err: unknown) =>
  act(async () => {
    settle.reject(err)
  })

beforeEach(() => {
  vi.clearAllMocks()
  store = createStore()
  fakeConfig = makeFakeConfig()
  connectors = [metamask]
  // The state a wallet button leaves behind.
  auth().goToStep('sign-up')
  auth().startWalletConnect({
    connectorUid: 'mm',
    name: 'MetaMask',
    icon: 'data:mm',
  })
})

describe('WalletConnecting', () => {
  it('connects the pending wallet exactly once on mount, under Strict Mode too', () => {
    render(
      <StrictMode>
        <WalletConnecting />
      </StrictMode>,
    )

    expect(connect).toHaveBeenCalledTimes(1)
    expect(connect).toHaveBeenCalledWith(fakeConfig, { connector: metamask })
    expect(screen.getByTestId('title').textContent).toBe('Waiting for MetaMask')
  })

  it('closes the widget and forgets the wallet when it approves', async () => {
    render(<WalletConnecting />)
    await approve()

    expect(auth().step).toBeNull()
    expect(auth().pendingWallet).toBeNull()
  })

  // The whole point of the screen: a wallet that never answers used to freeze
  // the sign-up page with no error and no way out.
  it('stays usable when the wallet never answers: the user can choose another method', () => {
    render(<WalletConnecting />)
    fireEvent.click(screen.getByText('Choose another sign-in method'))

    expect(auth().step).toBe('sign-up')
    // Popped, not pushed: sign-up must not grow a back arrow into this page.
    expect(auth().stepHistory).toEqual([])
  })

  // The bug that made "Choose another sign-in method" feel like the old
  // freeze: re-picking sent a second request, the wallet rejected it as
  // already pending, and the screen flickered straight back to sign-up.
  it('re-picking the same wallet while its request is open re-adopts it instead of firing a second connect()', () => {
    const { unmount } = render(<WalletConnecting />)
    expect(connect).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByText('Choose another sign-in method'))
    unmount()

    // Back on sign-up, the user picks MetaMask again.
    auth().startWalletConnect({ connectorUid: 'mm', name: 'MetaMask' })
    render(<WalletConnecting />)

    expect(connect).toHaveBeenCalledTimes(1)
    expect(auth().step).toBe('wallet-connecting')
    expect(screen.getByTestId('title').textContent).toBe('Waiting for MetaMask')
  })

  // Several wallets can be left unanswered at once, so the open request has
  // to be remembered per wallet, not one at a time.
  it('re-adopts the first wallet even after another wallet was tried in between', () => {
    const rabby: FakeConnector = { uid: 'rabby', name: 'Rabby Wallet' }
    connectors = [metamask, rabby]

    // MetaMask: leave it unanswered.
    const { unmount } = render(<WalletConnecting />)
    fireEvent.click(screen.getByText('Choose another sign-in method'))
    unmount()

    // Rabby: leave that unanswered too.
    auth().startWalletConnect({ connectorUid: 'rabby', name: 'Rabby Wallet' })
    const second = render(<WalletConnecting />)
    fireEvent.click(screen.getByText('Choose another sign-in method'))
    second.unmount()
    expect(connect).toHaveBeenCalledTimes(2)

    // Back to MetaMask, whose request is still open in the extension.
    auth().startWalletConnect({ connectorUid: 'mm', name: 'MetaMask' })
    render(<WalletConnecting />)

    expect(connect).toHaveBeenCalledTimes(2)
    expect(screen.getByTestId('title').textContent).toBe('Waiting for MetaMask')
  })

  it('sends a fresh request when the wallet already answered', async () => {
    const { unmount } = render(<WalletConnecting />)
    await rejectWith(new Error('User rejected the request.'))
    unmount()

    auth().startWalletConnect({ connectorUid: 'mm', name: 'MetaMask' })
    render(<WalletConnecting />)

    expect(connect).toHaveBeenCalledTimes(2)
  })

  // EIP-1193 has no cancel, so leaving does not close the wallet's request.
  it('closes the widget when the wallet is approved after the user left the screen', async () => {
    render(<WalletConnecting />)
    fireEvent.click(screen.getByText('Choose another sign-in method'))
    expect(auth().step).toBe('sign-up')

    await approve()

    expect(auth().step).toBeNull()
    expect(auth().pendingWallet).toBeNull()
  })

  it('explains a user rejection and offers retry or another method', async () => {
    const rejection = new Error('User rejected the request.')
    rejection.name = 'UserRejectedRequestError'
    render(<WalletConnecting />)
    await rejectWith(rejection)

    expect(screen.getByTestId('title').textContent).toBe('Request declined')
    expect(screen.getByTestId('body').textContent).toBe(
      'You declined the connection request in MetaMask.',
    )
    // Retry sends a fresh request; the wallet answered, so it is not re-adopted.
    fireEvent.click(screen.getByText('Try again'))
    expect(connect).toHaveBeenCalledTimes(2)
  })

  // wagmi's injected connector rethrows the wallet's own error, which carries
  // `code` but not viem's name.
  it("reads a wallet's own 4001 error as a rejection, not a failure", async () => {
    render(<WalletConnecting />)
    await rejectWith(
      Object.assign(new Error('User rejected the request.'), { code: 4001 }),
    )

    expect(screen.getByTestId('title').textContent).toBe('Request declined')
  })

  it('leaves the screen from the rejection state', async () => {
    render(<WalletConnecting />)
    await rejectWith({ code: 4001, message: 'User rejected the request.' })

    fireEvent.click(screen.getByText('Choose another sign-in method'))
    expect(auth().step).toBe('sign-up')
  })

  // The message is the only diagnostic a host gets for a real failure, and the
  // sign-up page that used to show it unmounts on the step change.
  it('shows the message for a failure that is not a user rejection', async () => {
    render(<WalletConnecting />)
    await rejectWith(new Error('Provider is not configured'))

    expect(auth().step).toBe('wallet-connecting')
    expect(screen.getByTestId('title').textContent).toBe('Couldn’t connect')
    expect(screen.getByTestId('body').textContent).toBe(
      'Provider is not configured',
    )
    // Still a way out.
    fireEvent.click(screen.getByText('Choose another sign-in method'))
    expect(auth().step).toBe('sign-up')
  })

  it('clears a stale error when the wallet is picked again', async () => {
    const { unmount } = render(<WalletConnecting />)
    await rejectWith(new Error('Provider is not configured'))
    unmount()

    auth().startWalletConnect({ connectorUid: 'mm', name: 'MetaMask' })
    render(<WalletConnecting />)

    expect(auth().connectError).toBeNull()
    expect(screen.getByTestId('title').textContent).toBe('Waiting for MetaMask')
  })

  // The abandoned prompt is still sitting in the extension, and a user who
  // bailed will often dismiss it later — by then they are somewhere else.
  it('ignores a late rejection once the user has moved on to another sign-in method', async () => {
    render(<WalletConnecting />)
    fireEvent.click(screen.getByText('Choose another sign-in method'))
    auth().goToStep('otp-input') // user entered their email instead

    await rejectWith(new Error('User rejected the request.'))

    expect(auth().step).toBe('otp-input')
  })

  it('ignores a late rejection once the user has started a different wallet', async () => {
    render(<WalletConnecting />)
    fireEvent.click(screen.getByText('Choose another sign-in method'))
    auth().startWalletConnect({ connectorUid: 'rabby', name: 'Rabby Wallet' })

    await rejectWith(new Error('User rejected the request.'))

    expect(auth().step).toBe('wallet-connecting')
    expect(auth().pendingWallet).toMatchObject({ connectorUid: 'rabby' })
  })

  it('closes immediately when the wallet is already connected, without calling connect()', () => {
    fakeConfig.state.connections = new Map([['mm', { connector: metamask }]])
    render(<WalletConnecting />)

    expect(connect).not.toHaveBeenCalled()
    expect(auth().step).toBeNull()
    expect(auth().pendingWallet).toBeNull()
  })

  it('returns to sign-up without calling connect when the connector has gone away', () => {
    connectors = []
    render(<WalletConnecting />)

    expect(connect).not.toHaveBeenCalled()
    expect(auth().step).toBe('sign-up')
    expect(auth().pendingWallet).toBeNull()
  })
})
