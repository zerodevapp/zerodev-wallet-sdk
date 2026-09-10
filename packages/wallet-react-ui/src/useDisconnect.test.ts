/**
 * @vitest-environment happy-dom
 */
import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDisconnect } from './useDisconnect'

afterEach(() => vi.clearAllMocks())

const rpcLog: string[] = []
const provider = {
  request: async ({ method }: { method: string }) => {
    rpcLog.push(method)
    return null
  },
}
const connector = {
  uid: 'mm',
  id: 'io.metamask',
  getProvider: async () => provider,
}
const fakeConfig = {
  state: {
    current: 'mm',
    connections: new Map([['mm', { connector }]]),
  },
}
// wagmi's injected connector: revoke, then shim. The wrapped hook must let
// everything through except the revoke.
// Like wagmi, talks to the provider of the connector it is asked to
// disconnect (the hook always pins one), falling back to the default one.
const disconnectAsync = vi.fn(async (...args: unknown[]) => {
  const [variables] = args as [
    { connector?: { getProvider: () => Promise<typeof provider> } }?,
  ]
  const target = (await variables?.connector?.getProvider()) ?? provider
  await target.request({ method: 'wallet_revokePermissions' })
  await target.request({ method: 'eth_chainId' })
})
/** What each wagmi hook was called with, per render. */
const hookCalls: { useConfig: unknown[]; useDisconnect: unknown[] } = {
  useConfig: [],
  useDisconnect: [],
}
vi.mock('wagmi', () => ({
  useConfig: (params?: unknown) => {
    hookCalls.useConfig.push(params)
    return fakeConfig
  },
  useDisconnect: (params?: unknown) => {
    hookCalls.useDisconnect.push(params)
    return {
      disconnect: vi.fn(),
      disconnectAsync: (...args: unknown[]) => disconnectAsync(...args),
      isPending: false,
    }
  },
}))

beforeEach(() => {
  rpcLog.length = 0
  hookCalls.useConfig.length = 0
  hookCalls.useDisconnect.length = 0
  fakeConfig.state.current = 'mm'
})

describe('useDisconnect', () => {
  it('suppresses wallet_revokePermissions during disconnect', async () => {
    const { result } = renderHook(() => useDisconnect())
    await result.current.disconnectAsync()
    expect(disconnectAsync).toHaveBeenCalledTimes(1)
    expect(rpcLog).toEqual(['eth_chainId'])
  })

  it('restores the provider request after disconnect', async () => {
    const { result } = renderHook(() => useDisconnect())
    await result.current.disconnectAsync()
    await provider.request({ method: 'wallet_revokePermissions' })
    expect(rpcLog).toEqual(['eth_chainId', 'wallet_revokePermissions'])
  })

  it('restores the exact original request function, not a bound copy', async () => {
    const originalRequest = provider.request
    const { result } = renderHook(() => useDisconnect())
    await result.current.disconnectAsync()
    // Integrations that compare, wrap, or restore `request` themselves must
    // see the provider exactly as it was before the disconnect.
    expect(provider.request).toBe(originalRequest)
  })

  it('restores the own-property descriptor, not just the function value', async () => {
    const before = Object.getOwnPropertyDescriptor(provider, 'request')
    const { result } = renderHook(() => useDisconnect())
    await result.current.disconnectAsync()
    expect(Object.getOwnPropertyDescriptor(provider, 'request')).toEqual(before)
  })

  it('leaves no own-property shadow when request is inherited from the prototype', async () => {
    // MetaMask's provider defines request() on its class prototype.
    class Proto {
      async request({ method }: { method: string }) {
        rpcLog.push(method)
        return null
      }
    }
    const inherited = new Proto()
    const inheritedConnector = {
      uid: 'inh',
      id: 'inherited',
      getProvider: async () => inherited,
    }
    fakeConfig.state.connections.set('inh', {
      connector: inheritedConnector as never,
    })
    fakeConfig.state.current = 'inh'

    const { result } = renderHook(() => useDisconnect())
    await result.current.disconnectAsync()
    expect(rpcLog).toEqual(['eth_chainId'])

    // Back to the prototype's method, with no own property left behind …
    expect(Object.hasOwn(inherited, 'request')).toBe(false)
    expect(inherited.request).toBe(Proto.prototype.request)
    // … so a later change to the prototype is seen by this instance.
    const replaced = async () => 'replaced'
    Proto.prototype.request = replaced as never
    expect(inherited.request).toBe(replaced)

    fakeConfig.state.connections.delete('inh')
  })

  it('still disconnects when the provider cannot be patched (frozen), prompt or not', async () => {
    const frozen = Object.freeze({
      request: async ({ method }: { method: string }) => {
        rpcLog.push(method)
        return null
      },
    })
    const frozenConnector = {
      uid: 'frz',
      id: 'frozen',
      getProvider: async () => frozen,
    }
    fakeConfig.state.connections.set('frz', {
      connector: frozenConnector as never,
    })
    fakeConfig.state.current = 'frz'

    const { result } = renderHook(() => useDisconnect())
    // Must not throw before wagmi's disconnect runs.
    await expect(result.current.disconnectAsync()).resolves.toBeUndefined()
    expect(disconnectAsync).toHaveBeenCalledTimes(1)
    // Best effort only: with no patch possible the revoke goes through.
    expect(rpcLog).toEqual(['wallet_revokePermissions', 'eth_chainId'])

    fakeConfig.state.connections.delete('frz')
  })

  it('patches a provider whose prototype exposes request as a getter', async () => {
    class GetterProto {
      get request() {
        return async ({ method }: { method: string }) => {
          rpcLog.push(method)
          return null
        }
      }
    }
    const getterProvider = new GetterProto()
    const getterConnector = {
      uid: 'get',
      id: 'getter',
      getProvider: async () => getterProvider,
    }
    fakeConfig.state.connections.set('get', {
      connector: getterConnector as never,
    })
    fakeConfig.state.current = 'get'

    const { result } = renderHook(() => useDisconnect())
    await result.current.disconnectAsync()
    // Plain assignment would have thrown (no setter); defineProperty works,
    // the revoke is suppressed, and the instance is clean afterwards.
    expect(rpcLog).toEqual(['eth_chainId'])
    expect(Object.hasOwn(getterProvider, 'request')).toBe(false)

    fakeConfig.state.connections.delete('get')
  })

  it('forwards the per-call mutation options to wagmi, from both functions', async () => {
    const { result } = renderHook(() => useDisconnect())
    const options = { onSuccess: vi.fn(), onError: vi.fn() }

    await result.current.disconnectAsync(undefined, options)
    // Options pass through; the connector is pinned (see the test below).
    expect(disconnectAsync).toHaveBeenLastCalledWith({ connector }, options)

    const variables = { connector: connector as never }
    result.current.disconnect(variables, options)
    await vi.waitFor(() =>
      expect(disconnectAsync).toHaveBeenLastCalledWith(variables, options),
    )
  })

  it('forwards its own parameters to both wagmi hooks', () => {
    const parameters = {
      config: fakeConfig as never,
      mutation: { onError: vi.fn() },
    }
    renderHook(() => useDisconnect(parameters))
    // `mutation` reaches wagmi's hook; `config` also drives the connector
    // lookup, so the provider patched belongs to the config disconnected.
    expect(hookCalls.useDisconnect[0]).toBe(parameters)
    expect(hookCalls.useConfig[0]).toBe(parameters)
  })

  it('pins the connector it patched, even if `current` moves during the await', async () => {
    const other = {
      uid: 'other',
      id: 'other',
      getProvider: async () => ({ request: async () => null }),
    }
    fakeConfig.state.connections.set('other', { connector: other as never })
    // A late approval lands while we await getProvider(): wagmi's `current`
    // now points at the other connector.
    const getProvider = vi
      .spyOn(connector, 'getProvider')
      .mockImplementationOnce(async () => {
        fakeConfig.state.current = 'other'
        return provider
      })

    const { result } = renderHook(() => useDisconnect())
    await result.current.disconnectAsync()

    // wagmi is told to disconnect the connector we patched, not `current`.
    expect(disconnectAsync).toHaveBeenLastCalledWith({ connector }, undefined)
    getProvider.mockRestore()
    fakeConfig.state.connections.delete('other')
  })

  it('restores the provider request even when disconnect rejects', async () => {
    disconnectAsync.mockRejectedValueOnce(new Error('boom'))
    const { result } = renderHook(() => useDisconnect())
    await expect(result.current.disconnectAsync()).rejects.toThrow('boom')
    await provider.request({ method: 'wallet_revokePermissions' })
    expect(rpcLog).toEqual(['wallet_revokePermissions'])
  })

  it('keeps the patch installed across overlapping disconnects', async () => {
    let releaseSecond!: () => void
    disconnectAsync
      // first disconnect: sends its revoke and finishes immediately
      .mockImplementationOnce(async () => {
        await provider.request({ method: 'wallet_revokePermissions' })
      })
      // second disconnect: holds until after the first has fully finished
      .mockImplementationOnce(async () => {
        await new Promise<void>((resolve) => {
          releaseSecond = resolve
        })
        await provider.request({ method: 'wallet_revokePermissions' })
      })
    const { result } = renderHook(() => useDisconnect())
    const first = result.current.disconnectAsync()
    const second = result.current.disconnectAsync()
    await first
    // The first call's release must not have restored the real request while
    // the second is still running — its revoke stays suppressed.
    releaseSecond()
    await second
    expect(rpcLog).toEqual([])
    // Both released: the provider is back to its real request.
    await provider.request({ method: 'wallet_revokePermissions' })
    expect(rpcLog).toEqual(['wallet_revokePermissions'])
  })

  it('falls through to plain disconnect when no provider is reachable', async () => {
    fakeConfig.state.current = null as never
    const { result } = renderHook(() => useDisconnect())
    await result.current.disconnectAsync()
    expect(disconnectAsync).toHaveBeenCalledTimes(1)
    fakeConfig.state.current = 'mm' as never
  })
})
