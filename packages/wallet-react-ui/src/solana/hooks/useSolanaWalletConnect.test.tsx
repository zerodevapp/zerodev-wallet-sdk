/**
 * @vitest-environment happy-dom
 */
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeWcProvider } from '../walletconnect/fakeProvider.fixture'
import { useSolanaWalletConnect } from './useSolanaWalletConnect'

const init = vi.hoisted(() => ({ fn: vi.fn() }))
vi.mock('@walletconnect/universal-provider', () => ({
  UniversalProvider: { init: init.fn },
}))

const connectors = vi.hoisted(() => ({ value: [] as unknown[] }))
vi.mock('wagmi', () => ({ useConnectors: () => connectors.value }))

const stamped = () => ({
  uid: crypto.randomUUID(),
  id: 'walletConnect',
  type: 'walletConnect',
  zdWalletConnect: true,
  zdWalletConnectParams: {
    projectId: `p-${crypto.randomUUID()}`,
    solana: true,
  },
})

beforeEach(() => {
  init.fn.mockReset()
})

describe('useSolanaWalletConnect', () => {
  it('is disabled without a stamped connector that enables Solana', () => {
    connectors.value = [{ id: 'injected', type: 'injected' }]
    const { result } = renderHook(() => useSolanaWalletConnect())
    expect(result.current.enabled).toBe(false)
    expect(result.current.wallet).toBeNull()
    expect(init.fn).not.toHaveBeenCalled()
  })

  it('answers enabled without loading the SDK when asked not to load', () => {
    connectors.value = [stamped()]
    const { result } = renderHook(() => useSolanaWalletConnect(false))
    expect(result.current.enabled).toBe(true)
    expect(result.current.wallet).toBeNull()
    expect(init.fn).not.toHaveBeenCalled()
  })

  it('recovers from a failed SDK init on retry', async () => {
    connectors.value = [stamped()]
    init.fn
      .mockRejectedValueOnce(new Error('Failed to fetch'))
      .mockResolvedValueOnce(fakeWcProvider())
    const { result } = renderHook(() => useSolanaWalletConnect())
    await waitFor(() => expect(result.current.error).toBe('Failed to fetch'))
    expect(result.current.wallet).toBeNull()

    act(() => result.current.retry())
    await waitFor(() => expect(result.current.wallet).not.toBeNull())
    expect(result.current.error).toBeNull()
    expect(init.fn).toHaveBeenCalledTimes(2)
  })
})
