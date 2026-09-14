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
type FakeState = {
  status: 'connected' | 'disconnected'
  current: string | null
  connections: Map<string, { connector: FakeConnector }>
}
type Sub = {
  selector: (s: FakeState) => unknown
  listener: (v: unknown, p: unknown) => void
  prev: unknown
}
function makeFakeConfig() {
  const config = {
    connectors: [{ id: 'zerodev-wallet', getKitStore: () => store }],
    state: {
      status: 'disconnected',
      current: null,
      connections: new Map(),
    } as FakeState,
    subs: new Set<Sub>(),
    subscribe(selector: Sub['selector'], listener: Sub['listener']) {
      const sub: Sub = { selector, listener, prev: selector(config.state) }
      config.subs.add(sub)
      return () => config.subs.delete(sub)
    },
    /** What wagmi does to its store when a connector connects. */
    connectAs(connector: FakeConnector) {
      config.state = {
        status: 'connected',
        current: connector.uid,
        connections: new Map([[connector.uid, { connector }]]),
      }
      for (const sub of [...config.subs]) {
        if (!config.subs.has(sub)) continue
        const next = sub.selector(config.state)
        if (next !== sub.prev) {
          const prev = sub.prev
          sub.prev = next
          sub.listener(next, prev)
        }
      }
    },
  }
  return config
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
  auth().startWalletConnection({
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
    auth().startWalletConnection({ connectorUid: 'mm', name: 'MetaMask' })
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
    auth().startWalletConnection({
      connectorUid: 'rabby',
      name: 'Rabby Wallet',
    })
    const second = render(<WalletConnecting />)
    fireEvent.click(screen.getByText('Choose another sign-in method'))
    second.unmount()
    expect(connect).toHaveBeenCalledTimes(2)

    // Back to MetaMask, whose request is still open in the extension.
    auth().startWalletConnection({ connectorUid: 'mm', name: 'MetaMask' })
    render(<WalletConnecting />)

    expect(connect).toHaveBeenCalledTimes(2)
    expect(screen.getByTestId('title').textContent).toBe('Waiting for MetaMask')
  })

  it('sends a fresh request when the wallet already answered', async () => {
    const { unmount } = render(<WalletConnecting />)
    await rejectWith(new Error('User rejected the request.'))
    unmount()

    auth().startWalletConnection({ connectorUid: 'mm', name: 'MetaMask' })
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
    // …and the screen says so, instead of keeping the failure it replaced.
    expect(screen.getByTestId('title').textContent).toBe('Waiting for MetaMask')
    expect(screen.queryByText('Try again')).toBeNull()
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

  // The common path: the original request is still owned by this page, so
  // answering it in the wallet reports straight back here — no -32002 at all.
  it('reports a cancellation made in the wallet after re-picking it', async () => {
    const { unmount } = render(<WalletConnecting />)
    const original = settle
    fireEvent.click(screen.getByText('Choose another sign-in method'))
    unmount()

    auth().startWalletConnect({ connectorUid: 'mm', name: 'MetaMask' })
    render(<WalletConnecting />)
    expect(connect).toHaveBeenCalledTimes(1) // re-adopted, not re-sent

    // The user dismisses it from the extension.
    await act(async () => {
      original.reject({ code: 4001, message: 'User rejected the request.' })
    })

    expect(screen.getByTestId('title').textContent).toBe('Request declined')
  })

  // The Reown edge case: the wallet holds the first request and refuses to
  // prompt again, so the user has to finish it in the extension.
  it("reads MetaMask's -32002 as a waiting state, not a failure", async () => {
    render(<WalletConnecting />)
    await rejectWith({
      code: -32002,
      message: 'Request of type wallet_requestPermissions already pending',
    })

    expect(screen.getByTestId('title').textContent).toBe(
      'Request waiting in MetaMask',
    )
    expect(screen.getByTestId('body').textContent).toContain(
      "Open MetaMask from your browser's toolbar",
    )
    expect(auth().connectError?.pending).toBe(true)
  })

  // Approving a request left over from a previous page load authorises the
  // site through the connector's own events, so our connect() never resolves.
  it('closes the widget when wagmi connects without our request resolving', async () => {
    render(<WalletConnecting />)
    await rejectWith({ code: -32002, message: 'already pending' })
    expect(screen.getByTestId('title').textContent).toBe(
      'Request waiting in MetaMask',
    )

    // The user approves the queued request in the extension.
    act(() => fakeConfig.connectAs(metamask))

    expect(auth().step).toBeNull()
    expect(auth().pendingWallet).toBeNull()
  })

  it('ignores wagmi connecting to some other wallet', async () => {
    render(<WalletConnecting />)
    await rejectWith({ code: -32002, message: 'already pending' })

    act(() => fakeConfig.connectAs({ uid: 'other', name: 'Other' }))

    expect(auth().step).toBe('wallet-connecting')
  })

  it('finds -32002 nested under cause, as wagmi wraps it', async () => {
    const wrapped = new Error('Connector error')
    ;(wrapped as { cause?: unknown }).cause = Object.assign(
      new Error('already pending'),
      { code: -32002 },
    )
    render(<WalletConnecting />)
    await rejectWith(wrapped)

    expect(screen.getByTestId('title').textContent).toBe(
      'Request waiting in MetaMask',
    )
  })

  it('never renders [object Object] for an error object with no message', async () => {
    render(<WalletConnecting />)
    await rejectWith({ code: -32603 })

    expect(screen.getByTestId('body').textContent).toBe(
      'Something went wrong while connecting to MetaMask. Please try again. (code -32603)',
    )
  })

  it("prefers viem's shortMessage over its long message", async () => {
    render(<WalletConnecting />)
    await rejectWith(
      Object.assign(new Error('a very long viem explanation'), {
        shortMessage: 'Connector not found.',
      }),
    )

    expect(screen.getByTestId('body').textContent).toBe('Connector not found.')
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

    auth().startWalletConnection({ connectorUid: 'mm', name: 'MetaMask' })
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
    auth().startWalletConnection({
      connectorUid: 'rabby',
      name: 'Rabby Wallet',
    })

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
