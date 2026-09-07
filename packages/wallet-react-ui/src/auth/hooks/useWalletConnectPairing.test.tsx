/**
 * @vitest-environment happy-dom
 */
import { act, cleanup, renderHook } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WALLET_GUIDE } from '../walletGuide'
import { useWalletConnectPairing } from './useWalletConnectPairing'

afterEach(cleanup)

const goToStep = vi.fn()
vi.mock('./useAuth', () => ({
  useAuth: () => ({ goToStep }),
}))

const mobile = vi.hoisted(() => ({ value: false }))
vi.mock('../utils/isMobile', () => ({
  isMobile: () => mobile.value,
}))

const connect = vi.fn()
let connectors: unknown[] = []
let connections: unknown[] = []
let reconnecting = false
vi.mock('wagmi', () => ({
  useConnectors: () => connectors,
  useConnect: () => ({ connect }),
  useConnections: () => connections,
  useAccount: () => ({ isReconnecting: reconnecting }),
}))

type MessageHandler = (event: { type: string; data?: unknown }) => void

/** Connector double with a working `message` emitter and a provider that
 * emits `connect` on fresh session settles and whose sign-client emits
 * `proposal_expire`. Stamped like the zeroDevWalletConnect factory's output
 * unless `stamped: false`. */
function fakeWcConnector({ stamped = true } = {}) {
  const handlers = new Set<MessageHandler>()
  const expireHandlers = new Set<() => void>()
  const connectHandlers = new Set<() => void>()
  const expiryEvents = {
    on: vi.fn((_event: string, handler: () => void) => {
      expireHandlers.add(handler)
    }),
    off: vi.fn((_event: string, handler: () => void) => {
      expireHandlers.delete(handler)
    }),
  }
  const provider = {
    on: vi.fn((_event: string, handler: () => void) => {
      connectHandlers.add(handler)
    }),
    off: vi.fn((_event: string, handler: () => void) => {
      connectHandlers.delete(handler)
    }),
    signer: { client: { events: expiryEvents } },
  }
  return {
    uid: crypto.randomUUID(),
    id: 'walletConnect',
    type: 'walletConnect',
    ...(stamped && { zdWalletConnect: true }),
    emitter: {
      on: vi.fn((_event: string, handler: MessageHandler) => {
        handlers.add(handler)
      }),
      off: vi.fn((_event: string, handler: MessageHandler) => {
        handlers.delete(handler)
      }),
    },
    emit: (event: { type: string; data?: unknown }) => {
      for (const handler of handlers) handler(event)
    },
    getProvider: vi.fn(async () => provider),
    provider,
    expiryEvents,
    expireProposal: () => {
      for (const handler of expireHandlers) handler()
    },
    settleSession: () => {
      for (const handler of connectHandlers) handler()
    },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  connectors = []
  connections = []
  reconnecting = false
  mobile.value = false
})

describe('useWalletConnectPairing', () => {
  it('is idle without a walletConnect connector', () => {
    const { result } = renderHook(() => useWalletConnectPairing())
    expect(result.current.uri).toBeNull()
    expect(connect).not.toHaveBeenCalled()
  })

  it('kicks the pairing on mount', () => {
    const wc = fakeWcConnector()
    connectors = [wc]
    renderHook(() => useWalletConnectPairing())
    expect(connect).toHaveBeenCalledTimes(1)
    expect(connect.mock.calls[0][0]).toEqual({ connector: wc })
  })

  it('subscribes to messages before kicking the connect', () => {
    const wc = fakeWcConnector()
    connectors = [wc]
    renderHook(() => useWalletConnectPairing())
    expect(wc.emitter.on.mock.invocationCallOrder[0]).toBeLessThan(
      connect.mock.invocationCallOrder[0],
    )
  })

  it('captures display_uri and ignores other messages', () => {
    const wc = fakeWcConnector()
    connectors = [wc]
    const { result } = renderHook(() => useWalletConnectPairing())
    act(() => wc.emit({ type: 'other', data: 'nope' }))
    act(() => wc.emit({ type: 'display_uri', data: 123 }))
    expect(result.current.uri).toBeNull()

    act(() => wc.emit({ type: 'display_uri', data: 'wc:abc@2?relay' }))
    expect(result.current.uri).toBe('wc:abc@2?relay')
  })

  it('kicks the pairing exactly once under Strict Mode', () => {
    const wc = fakeWcConnector()
    connectors = [wc]
    renderHook(() => useWalletConnectPairing(), { wrapper: StrictMode })
    expect(connect).toHaveBeenCalledTimes(1)
  })

  it('closes the auth flow when a fresh session settles, surviving Strict Mode', async () => {
    const wc = fakeWcConnector()
    connectors = [wc]
    renderHook(() => useWalletConnectPairing(), { wrapper: StrictMode })
    // Let the async getProvider subscription settle.
    await act(async () => {})
    expect(goToStep).not.toHaveBeenCalled()

    // The provider's `connect` event = the user approved OUR pairing.
    act(() => wc.settleSession())
    expect(goToStep).toHaveBeenCalledWith(null)
  })

  it('does not close the flow for a session restored before mount', () => {
    const wc = fakeWcConnector()
    connectors = [wc]
    connections = [{ connector: wc }]
    renderHook(() => useWalletConnectPairing())
    expect(goToStep).not.toHaveBeenCalled()
  })

  it('does not close the flow when a session restores after mount', async () => {
    // The rehydration race: wagmi finishes restoring a persisted session
    // AFTER the sign-up page mounted. A restored session emits no provider
    // `connect` event, so the flow must stay open.
    const wc = fakeWcConnector()
    connectors = [wc]
    const { rerender } = renderHook(() => useWalletConnectPairing())
    await act(async () => {})

    connections = [{ connector: wc }]
    rerender()
    expect(goToStep).not.toHaveBeenCalled()
  })

  it('defers the pairing kick while wagmi is reconnecting', () => {
    const wc = fakeWcConnector()
    connectors = [wc]
    reconnecting = true
    const { rerender } = renderHook(() => useWalletConnectPairing())
    expect(connect).not.toHaveBeenCalled()

    // Rehydration settled without a connection — now the kick runs.
    reconnecting = false
    rerender()
    expect(connect).toHaveBeenCalledTimes(1)
  })

  it('surfaces provider init failure through the error state', async () => {
    const wc = fakeWcConnector()
    wc.getProvider.mockRejectedValueOnce(new Error('relay unreachable'))
    connectors = [wc]
    const { result } = renderHook(() => useWalletConnectPairing())
    await act(async () => {})
    expect(result.current.error).toBe('relay unreachable')
  })

  it('errors on proposal expiry via the sign-client event, surviving Strict Mode', async () => {
    const wc = fakeWcConnector()
    connectors = [wc]
    const { result } = renderHook(() => useWalletConnectPairing(), {
      wrapper: StrictMode,
    })
    // Let the async getProvider subscription settle.
    await act(async () => {})
    act(() => wc.emit({ type: 'display_uri', data: 'wc:t@2?relay' }))

    act(() => wc.expireProposal())
    expect(result.current.error).toBe('Proposal expired')

    const metamask = WALLET_GUIDE.find((w) => w.id === 'metamask')
    if (!metamask) throw new Error('metamask missing from WALLET_GUIDE')
    mobile.value = true
    expect(result.current.deepLinkFor(metamask)).toBeNull()
  })

  it('surfaces connect errors and retry resets state and reconnects', () => {
    const wc = fakeWcConnector()
    connectors = [wc]
    const { result } = renderHook(() => useWalletConnectPairing())
    act(() => wc.emit({ type: 'display_uri', data: 'wc:stale' }))
    act(() => connect.mock.calls[0][1].onError(new Error('relay down')))
    expect(result.current.error).toBe('relay down')

    act(() => result.current.retry())
    expect(result.current.error).toBeNull()
    expect(result.current.uri).toBeNull()
    expect(connect).toHaveBeenCalledTimes(2)
  })

  it('uses the factory-stamped connector, never a raw walletConnect one', () => {
    const raw = fakeWcConnector({ stamped: false })
    const stamped = fakeWcConnector()
    connectors = [raw, stamped] // raw first — type-based discovery would pick it
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    renderHook(() => useWalletConnectPairing())
    expect(connect.mock.calls[0][0]).toEqual({ connector: stamped })
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it('ignores a raw walletConnect connector', () => {
    const raw = fakeWcConnector({ stamped: false })
    connectors = [raw]
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { result } = renderHook(() => useWalletConnectPairing())
    expect(connect).not.toHaveBeenCalled()
    expect(result.current.uri).toBeNull()
    warn.mockRestore()
  })

  it('skips the kick when the connector already has a live connection', () => {
    const wc = fakeWcConnector()
    connectors = [wc]
    // Restored session: wagmi reconnected the WC connector at boot —
    // connect() here would throw ConnectorAlreadyConnectedError.
    connections = [{ connector: wc }]
    renderHook(() => useWalletConnectPairing())
    expect(connect).not.toHaveBeenCalled()
  })

  it('unsubscribes its message and expiry handlers on unmount', async () => {
    const wc = fakeWcConnector()
    connectors = [wc]
    const { unmount } = renderHook(() => useWalletConnectPairing())
    await act(async () => {})
    const handler = wc.emitter.on.mock.calls[0][1]
    const expireHandler = wc.expiryEvents.on.mock.calls[0][1]
    unmount()
    expect(wc.emitter.off).toHaveBeenCalledWith('message', handler)
    expect(wc.expiryEvents.off).toHaveBeenCalledWith(
      'proposal_expire',
      expireHandler,
    )
    expect(wc.provider.off).toHaveBeenCalledWith(
      'connect',
      wc.provider.on.mock.calls[0][1],
    )
  })

  it('deepLinkFor wraps the URI on mobile and stays null on desktop', () => {
    const metamask = WALLET_GUIDE.find((w) => w.id === 'metamask')
    if (!metamask) throw new Error('metamask missing from WALLET_GUIDE')
    const wc = fakeWcConnector()
    connectors = [wc]
    const { result } = renderHook(() => useWalletConnectPairing())
    act(() => wc.emit({ type: 'display_uri', data: 'wc:t@2?relay' }))

    expect(result.current.deepLinkFor(metamask)).toBeNull() // desktop
    mobile.value = true
    expect(result.current.deepLinkFor(metamask)).toBe(
      `${metamask.mobileLink}${encodeURIComponent('wc:t@2?relay')}`,
    )
  })

  it('deepLinkFor goes null once the pairing errors — e.g. proposal expiry', () => {
    const metamask = WALLET_GUIDE.find((w) => w.id === 'metamask')
    if (!metamask) throw new Error('metamask missing from WALLET_GUIDE')
    mobile.value = true
    const wc = fakeWcConnector()
    connectors = [wc]
    const { result } = renderHook(() => useWalletConnectPairing())
    act(() => wc.emit({ type: 'display_uri', data: 'wc:t@2?relay' }))
    expect(result.current.deepLinkFor(metamask)).not.toBeNull()

    act(() => connect.mock.calls[0][1].onError(new Error('Proposal expired')))
    expect(result.current.deepLinkFor(metamask)).toBeNull()
  })
})
