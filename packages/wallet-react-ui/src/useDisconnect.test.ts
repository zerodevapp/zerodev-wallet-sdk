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
const disconnectAsync = vi.fn(async (..._args: unknown[]) => {
  await provider.request({ method: 'wallet_revokePermissions' })
  await provider.request({ method: 'eth_chainId' })
})
vi.mock('wagmi', () => ({
  useConfig: () => fakeConfig,
  useDisconnect: () => ({
    disconnect: vi.fn(),
    disconnectAsync: (...args: unknown[]) => disconnectAsync(...args),
    isPending: false,
  }),
}))

beforeEach(() => {
  rpcLog.length = 0
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

  it('forwards the per-call mutation options to wagmi, from both functions', async () => {
    const { result } = renderHook(() => useDisconnect())
    const options = { onSuccess: vi.fn(), onError: vi.fn() }

    await result.current.disconnectAsync(undefined, options)
    expect(disconnectAsync).toHaveBeenLastCalledWith(undefined, options)

    const variables = { connector: connector as never }
    result.current.disconnect(variables, options)
    await vi.waitFor(() =>
      expect(disconnectAsync).toHaveBeenLastCalledWith(variables, options),
    )
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
