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
const connect = vi.fn()
type FakeConnector = { uid: string; name: string; icon?: string }
let connectors: FakeConnector[] = []
vi.mock('wagmi', () => ({
  useConfig: () => ({
    connectors: [{ id: 'zerodev-wallet', getKitStore: () => store }],
  }),
  useConnectors: () => connectors,
  useConnect: () => ({ connect }),
}))

const metamask: FakeConnector = { uid: 'mm', name: 'MetaMask', icon: 'data:mm' }
const auth = () => store.getState().auth
const callbacks = () =>
  connect.mock.calls.at(-1)?.[1] as {
    onSuccess: () => void
    onError: (err: unknown) => void
  }

beforeEach(() => {
  vi.clearAllMocks()
  store = createStore()
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
    expect(connect.mock.calls[0][0]).toEqual({ connector: metamask })
    expect(screen.getByTestId('title').textContent).toBe(
      'Connecting to MetaMask',
    )
  })

  it('closes the widget and forgets the wallet when it approves', () => {
    render(<WalletConnecting />)
    act(() => callbacks().onSuccess())
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

  it('explains a user rejection and offers retry or another method', () => {
    render(<WalletConnecting />)
    const rejection = new Error('User rejected the request.')
    rejection.name = 'UserRejectedRequestError'
    act(() => callbacks().onError(rejection))
    expect(screen.getByTestId('body').textContent).toContain(
      'declined the connection request in MetaMask',
    )

    fireEvent.click(screen.getByText('Try again'))
    expect(connect).toHaveBeenCalledTimes(2)
    expect(auth().connectError).toBeNull()

    act(() => callbacks().onError(rejection))
    fireEvent.click(screen.getByText('Choose another sign-in method'))
    expect(auth().step).toBe('sign-up')
  })

  it("translates MetaMask's -32002 'already pending' into an actionable message", () => {
    render(<WalletConnecting />)
    const wrapped = new Error('Connector error')
    ;(wrapped as { cause?: unknown }).cause = Object.assign(
      new Error('Request of type wallet_requestPermissions already pending'),
      { code: -32002 },
    )
    act(() => callbacks().onError(wrapped))
    expect(screen.getByTestId('body').textContent).toContain(
      'already has a connection request open',
    )
  })

  it('surfaces other failures verbatim', () => {
    render(<WalletConnecting />)
    act(() => callbacks().onError(new Error('boom')))
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
})
