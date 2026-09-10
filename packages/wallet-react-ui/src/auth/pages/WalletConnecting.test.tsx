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
  (..._args: unknown[]) =>
    new Promise<void>((resolve, reject) => {
      settle = { resolve: () => resolve(), reject }
    }),
)
type FakeConnector = { uid: string; name: string; icon?: string }
let connectors: FakeConnector[] = []
// Minimal wagmi config store: useKitStore reads the kit connector off it, and
// the page subscribes to it for the connection signal that outlives React.
// A factory so a test can stand up two provider trees (two configs, two kit
// stores) side by side.
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
function makeFakeConfig(kitStore: ReturnType<typeof createStore>) {
  const config = {
    connectors: [{ id: 'zerodev-wallet', getKitStore: () => kitStore }],
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
    /** What wagmi does to its store when a connector's connect() succeeds. */
    connectAs(connector: FakeConnector) {
      config.state = {
        status: 'connected',
        current: connector.uid,
        connections: new Map([[connector.uid, { connector }]]),
      }
      for (const sub of config.subs) {
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
/** The config `useConfig()` hands the page; swapped per test where needed. */
let fakeConfig = makeFakeConfig(store)
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
  fakeConfig = makeFakeConfig(store)
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
    expect(screen.getByTestId('title').textContent).toBe('Waiting for MetaMask')
  })

  it('closes the widget and forgets the wallet when it approves', async () => {
    render(<WalletConnecting />)
    await approve()
    expect(auth().step).toBeNull()
    // Otherwise reopening the widget later, with this wallet still
    // connected, would close it on sight.
    expect(auth().pendingWallet).toBeNull()
  })

  it('keeps the wallet record after leaving the screen, so a late approval can still close the widget', () => {
    render(<WalletConnecting />)
    fireEvent.click(screen.getByText('Choose another sign-in method'))
    expect(auth().step).toBe('sign-up')
    expect(auth().pendingWallet).toMatchObject({ connectorUid: 'mm' })
  })

  it('returns to sign-up by popping history, so the back arrow cannot remount this page and re-prompt the wallet', () => {
    // A wallet button on sign-up pushed 'sign-up' under us (see beforeEach).
    expect(auth().stepHistory).toEqual(['sign-up'])
    render(<WalletConnecting />)
    fireEvent.click(screen.getByText('Choose another sign-in method'))

    expect(auth().step).toBe('sign-up')
    // Nothing left to go back into: sign-up shows no back arrow, and there is
    // no path that remounts this page against the still-open request.
    expect(auth().stepHistory).toEqual([])
    connect.mockClear()
    auth().goBack()
    expect(auth().step).toBe('sign-up')
    expect(connect).not.toHaveBeenCalled()
  })

  it('stays usable when the wallet never answers: the user can choose another method', () => {
    // Locked wallet, or the user closed the popup: no callback ever fires.
    render(<WalletConnecting />)
    fireEvent.click(screen.getByText('Choose another sign-in method'))
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
    expect(screen.getByTestId('title').textContent).toBe('Request declined')
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

  it("shows 'Request declined' for a wallet's own ProviderRpcError (Error with code 4001, generic name)", async () => {
    render(<WalletConnecting />)
    // MetaMask's provider error: extends Error, carries `code`, name 'Error'.
    await rejectWith(
      Object.assign(new Error('User rejected the request.'), { code: 4001 }),
    )

    expect(screen.getByTestId('title').textContent).toBe('Request declined')
    expect(auth().connectError).toMatchObject({ pending: false })
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
      'still has your connection request open',
    )
  })

  it("handles MetaMask's raw -32002 object (closed popup, clicked again) without printing [object Object]", async () => {
    // wagmi's injected connector rethrows the wallet's JSON-RPC error object
    // unwrapped for -32002 — not an Error instance.
    render(<WalletConnecting />)
    await rejectWith({
      code: -32002,
      message:
        'Request of type wallet_requestPermissions already pending for origin http://localhost:3000.',
    })
    // A waiting state, not a failure.
    expect(screen.getByTestId('title').textContent).toBe(
      'Request waiting in MetaMask',
    )
    const body = screen.getByTestId('body').textContent ?? ''
    expect(body).toContain('still has your connection request open')
    expect(body).toContain("browser's toolbar")
    expect(body).not.toContain('[object Object]')
  })

  it("shows a raw error object's message rather than [object Object]", async () => {
    render(<WalletConnecting />)
    await rejectWith({ code: -32603, message: 'Internal JSON-RPC error.' })
    const body = screen.getByTestId('body').textContent ?? ''
    expect(body).toContain('Internal JSON-RPC error.')
    expect(body).not.toContain('[object Object]')
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

    it('keeps watching after the user leaves the screen, so a late approval closes the widget', () => {
      render(<WalletConnecting />)
      fireEvent.click(screen.getByText('Choose another sign-in method'))
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

    // connect() can't be cancelled, so the wallet the user walked away from
    // can still answer later. Its rejection must not land on the screen of the
    // wallet they picked next.
    it("ignores a late rejection from a wallet the user already left, so it can't overwrite the next wallet's screen", async () => {
      const rabby: FakeConnector = { uid: 'rabby', name: 'Rabby Wallet' }
      connectors = [metamask, rabby]

      // MetaMask: start, leave it pending, choose another method.
      const { unmount } = render(<WalletConnecting />)
      const settleMetaMask = settle
      fireEvent.click(screen.getByText('Choose another sign-in method'))
      unmount()

      // Rabby: a fresh attempt on the same tree.
      auth().startWalletConnect({ connectorUid: 'rabby', name: 'Rabby Wallet' })
      render(<WalletConnecting />)
      expect(screen.getByTestId('title').textContent).toBe(
        'Waiting for Rabby Wallet',
      )

      // The user finally closes the MetaMask popup.
      const rejection = new Error('User rejected the request.')
      rejection.name = 'UserRejectedRequestError'
      await act(async () => {
        settleMetaMask.reject(rejection)
      })

      // Rabby's screen is untouched and still waiting.
      expect(auth().connectError).toBeNull()
      expect(auth().step).toBe('wallet-connecting')
      expect(auth().pendingWallet).toMatchObject({ connectorUid: 'rabby' })
      expect(screen.getByTestId('title').textContent).toBe(
        'Waiting for Rabby Wallet',
      )
      // Rabby's own answer still reports normally.
      await rejectWith(rejection)
      expect(auth().connectError?.message).toContain('Rabby Wallet')
    })

    // Watchers are keyed by wagmi config, not held in one module variable: a
    // page with two WagmiProvider trees must not have the second tree's
    // attempt tear down the first tree's watcher.
    it('keeps one watcher per wagmi config, so a second provider tree does not cancel the first', () => {
      // Tree A: the beforeEach state — start its connect and leave.
      const configA = fakeConfig
      const storeA = store
      const { unmount: unmountA } = render(<WalletConnecting />)
      unmountA()
      expect(configA.subs.size).toBe(1)

      // Tree B: its own wagmi config and kit store, same wallet.
      const storeB = createStore()
      const configB = makeFakeConfig(storeB)
      storeB.getState().auth.goToStep('sign-up')
      storeB.getState().auth.startWalletConnect({
        connectorUid: 'mm',
        name: 'MetaMask',
      })
      fakeConfig = configB
      store = storeB
      render(<WalletConnecting />)

      // B's attempt left A's watcher alone.
      expect(configA.subs.size).toBe(1)
      expect(configB.subs.size).toBe(1)

      // A late approval in tree A closes A's flow, and only A's.
      act(() => configA.connectAs(metamask))
      expect(storeA.getState().auth.step).toBeNull()
      expect(storeA.getState().auth.pendingWallet).toBeNull()
      expect(configA.subs.size).toBe(0)
      expect(storeB.getState().auth.step).toBe('wallet-connecting')
      expect(configB.subs.size).toBe(1)
    })
  })
})
