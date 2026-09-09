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

// A real kit store behind useAuth (useKitStore reads it off the wagmi
// config), so step / error transitions are asserted on real state.
let store = createStore()
/** Deferred for the in-flight @wagmi/core connect(); one per attempt. */
let settle: { resolve: () => void; reject: (err: unknown) => void }
const connect = vi.fn(
  () =>
    new Promise<void>((resolve, reject) => {
      settle = { resolve: () => resolve(), reject }
    }),
)
type FakeConnector = { uid: string; name: string; icon?: string }
let connectors: FakeConnector[] = []
// Minimal wagmi config store: useKitStore reads the kit connector off it, and
// the page subscribes to it for the connection signal that outlives React.
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
const fakeConfig = {
  connectors: [{ id: 'zerodev-wallet', getKitStore: () => store }],
  state: {
    status: 'disconnected',
    current: null,
    connections: new Map(),
  } as FakeState,
  subs: new Set<Sub>(),
  subscribe(selector: Sub['selector'], listener: Sub['listener']) {
    const sub: Sub = { selector, listener, prev: selector(fakeConfig.state) }
    fakeConfig.subs.add(sub)
    return () => fakeConfig.subs.delete(sub)
  },
  /** What wagmi does to its store when a connector's connect() succeeds. */
  connectAs(connector: FakeConnector) {
    fakeConfig.state = {
      status: 'connected',
      current: connector.uid,
      connections: new Map([[connector.uid, { connector }]]),
    }
    for (const sub of fakeConfig.subs) {
      const next = sub.selector(fakeConfig.state)
      if (next !== sub.prev) {
        const prev = sub.prev
        sub.prev = next
        sub.listener(next, prev)
      }
    }
  },
  reset() {
    fakeConfig.state = {
      status: 'disconnected',
      current: null,
      connections: new Map(),
    }
    fakeConfig.subs.clear()
  },
}
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
  fakeConfig.reset()
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
    // A second connect() would trip the wallet's "request already pending".
    expect(connect).toHaveBeenCalledTimes(1)
    expect(connect.mock.calls[0][1]).toEqual({ connector: metamask })
    expect(screen.getByTestId('title').textContent).toBe(
      'Connecting to MetaMask',
    )
  })

  it('closes the widget and forgets the wallet when it approves', async () => {
    render(<WalletConnecting />)
    await approve()
    expect(auth().step).toBeNull()
    // Otherwise reopening the widget later, with this wallet still
    // connected, would close it on sight.
    expect(auth().pendingWallet).toBeNull()
  })

  it('keeps the wallet record after Cancel, so a late approval can still close the widget', () => {
    render(<WalletConnecting />)
    fireEvent.click(screen.getByText('Cancel'))
    expect(auth().step).toBe('sign-up')
    expect(auth().pendingWallet).toMatchObject({ connectorUid: 'mm' })
  })

  it('stays usable when the wallet never answers: Cancel returns to sign-up', () => {
    // Locked wallet, or the user closed the popup: no callback ever fires.
    render(<WalletConnecting />)
    fireEvent.click(screen.getByText('Cancel'))
    expect(auth().step).toBe('sign-up')
  })

  it('explains a user rejection and offers retry or another method, under Strict Mode too', async () => {
    render(
      <StrictMode>
        <WalletConnecting />
      </StrictMode>,
    )
    const rejection = new Error('User rejected the request.')
    rejection.name = 'UserRejectedRequestError'
    await rejectWith(rejection)
    expect(screen.getByTestId('body').textContent).toContain(
      'declined the connection request in MetaMask',
    )

    fireEvent.click(screen.getByText('Try again'))
    expect(connect).toHaveBeenCalledTimes(2)
    expect(auth().connectError).toBeNull()

    await rejectWith(rejection)
    fireEvent.click(screen.getByText('Choose another sign-in method'))
    expect(auth().step).toBe('sign-up')
  })

  it("translates MetaMask's -32002 'already pending' into an actionable message", async () => {
    render(<WalletConnecting />)
    const wrapped = new Error('Connector error')
    ;(wrapped as { cause?: unknown }).cause = Object.assign(
      new Error('Request of type wallet_requestPermissions already pending'),
      { code: -32002 },
    )
    await rejectWith(wrapped)
    expect(screen.getByTestId('body').textContent).toContain(
      'already has a connection request open',
    )
  })

  it('surfaces other failures verbatim', async () => {
    render(<WalletConnecting />)
    await rejectWith(new Error('boom'))
    expect(screen.getByTestId('body').textContent).toContain('boom')
  })

  it('errors without calling connect when the connector has gone away', () => {
    connectors = []
    render(<WalletConnecting />)
    expect(connect).not.toHaveBeenCalled()
    expect(screen.getByTestId('body').textContent).toContain(
      'no longer available',
    )
  })

  describe('host unmounts the widget the moment wagmi connects', () => {
    // The demo (and most hosts) redirect on `isConnected`, unmounting the
    // widget in that same render — the mutation callbacks never fire.
    it('still closes the flow via the wagmi store, so the next mount does not re-prompt the wallet', () => {
      const { unmount } = render(<WalletConnecting />)
      unmount()
      act(() => fakeConfig.connectAs(metamask))

      expect(auth().step).toBeNull()
      expect(auth().pendingWallet).toBeNull()
      // Remounting later (e.g. after logout) must not fire connect() again.
      connect.mockClear()
      render(<WalletConnecting />)
      expect(connect).not.toHaveBeenCalled()
    })

    it('ignores a connection to some other connector', () => {
      const { unmount } = render(<WalletConnecting />)
      unmount()
      act(() => fakeConfig.connectAs({ uid: 'other', name: 'Other' }))

      expect(auth().step).toBe('wallet-connecting')
      expect(auth().pendingWallet).toMatchObject({ connectorUid: 'mm' })
    })

    it('keeps watching after Cancel, so a late approval closes the widget', () => {
      render(<WalletConnecting />)
      fireEvent.click(screen.getByText('Cancel'))
      expect(auth().step).toBe('sign-up')

      act(() => fakeConfig.connectAs(metamask))
      expect(auth().step).toBeNull()
      expect(auth().pendingWallet).toBeNull()
    })

    it('stops watching once the wallet rejects', async () => {
      render(<WalletConnecting />)
      const rejection = new Error('User rejected the request.')
      rejection.name = 'UserRejectedRequestError'
      await rejectWith(rejection)
      expect(fakeConfig.subs.size).toBe(0)
    })
  })
})
