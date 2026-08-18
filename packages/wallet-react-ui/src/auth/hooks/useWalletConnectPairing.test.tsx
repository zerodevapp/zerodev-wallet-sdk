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
vi.mock('wagmi', () => ({
  useConnectors: () => connectors,
  useConnect: () => ({ mutate: connect }),
  useConnections: () => connections,
}))

type MessageHandler = (event: { type: string; data?: unknown }) => void

/** Connector double with a working `message` emitter. Stamped like the
 * zeroDevWalletConnect factory's output unless `stamped: false`. */
function fakeWcConnector({ stamped = true } = {}) {
  const handlers = new Set<MessageHandler>()
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
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  connectors = []
  connections = []
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

  it('closes the auth flow when the pairing connects', () => {
    const wc = fakeWcConnector()
    connectors = [wc]
    renderHook(() => useWalletConnectPairing())
    act(() => connect.mock.calls[0][1].onSuccess())
    expect(goToStep).toHaveBeenCalledWith(null)
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

  it('unsubscribes its message handler on unmount', () => {
    const wc = fakeWcConnector()
    connectors = [wc]
    const { unmount } = renderHook(() => useWalletConnectPairing())
    const handler = wc.emitter.on.mock.calls[0][1]
    unmount()
    expect(wc.emitter.off).toHaveBeenCalledWith('message', handler)
  })

  it('parses the URI expiryTimestamp into expiresAt', () => {
    const wc = fakeWcConnector()
    connectors = [wc]
    const { result } = renderHook(() => useWalletConnectPairing())
    act(() =>
      wc.emit({
        type: 'display_uri',
        data: 'wc:t@2?relay-protocol=irn&symKey=s&expiryTimestamp=1755500000',
      }),
    )
    expect(result.current.expiresAt).toBe(1_755_500_000_000)
  })

  it('falls back to the 5-minute TTL when the URI carries no expiry', () => {
    const wc = fakeWcConnector()
    connectors = [wc]
    const { result } = renderHook(() => useWalletConnectPairing())
    const before = Date.now()
    act(() => wc.emit({ type: 'display_uri', data: 'wc:t@2?relay' }))
    const ttl = 5 * 60_000
    expect(result.current.expiresAt).toBeGreaterThanOrEqual(before + ttl)
    expect(result.current.expiresAt).toBeLessThanOrEqual(Date.now() + ttl)
  })

  it('deepLinkFor wraps the fresh URI on mobile and stays null on desktop', () => {
    const metamask = WALLET_GUIDE.find((w) => w.id === 'metamask')
    if (!metamask) throw new Error('metamask missing from WALLET_GUIDE')
    const wc = fakeWcConnector()
    connectors = [wc]
    const { result } = renderHook(() => useWalletConnectPairing())
    const uri = `wc:t@2?expiryTimestamp=${Math.floor((Date.now() + 60_000) / 1000)}`
    act(() => wc.emit({ type: 'display_uri', data: uri }))

    expect(result.current.deepLinkFor(metamask)).toBeNull() // desktop
    mobile.value = true
    expect(result.current.deepLinkFor(metamask)).toBe(
      `${metamask.mobileLink}${encodeURIComponent(uri)}`,
    )
  })
})
