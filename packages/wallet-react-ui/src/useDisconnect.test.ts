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
const disconnectAsync = vi.fn(async () => {
  await provider.request({ method: 'wallet_revokePermissions' })
  await provider.request({ method: 'eth_chainId' })
})
vi.mock('wagmi', () => ({
  useConfig: () => fakeConfig,
  useDisconnect: () => ({
    disconnect: vi.fn(),
    disconnectAsync: (v?: unknown) => disconnectAsync(v),
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

  it('restores the provider request even when disconnect rejects', async () => {
    disconnectAsync.mockRejectedValueOnce(new Error('boom'))
    const { result } = renderHook(() => useDisconnect())
    await expect(result.current.disconnectAsync()).rejects.toThrow('boom')
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
