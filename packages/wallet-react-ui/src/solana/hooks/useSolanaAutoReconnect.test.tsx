/**
 * @vitest-environment happy-dom
 */
import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSolanaAutoReconnect } from './useSolanaAutoReconnect'

const guard = vi.hoisted(() => ({
  mount: vi.fn(),
  cleanup: vi.fn(),
}))
vi.mock('../evmAdoptionGuard', () => ({
  guardDormantEvmSide: guard.mount,
}))

/** wagmi's config and connectors as the hook reads them; `connectors.value`
 * changes when a provider announces itself late. */
const wagmi = vi.hoisted(() => ({
  config: {
    _internal: { ssr: false },
    state: { connections: new Map() },
  },
  connectors: { value: [] as unknown[] },
}))
vi.mock('wagmi', () => ({
  useConfig: () => wagmi.config,
  useConnectors: () => wagmi.connectors.value,
}))

vi.mock('../../shared/hooks/useKitStore', () => ({
  useKitStore: () => ({
    getState: () => ({
      solana: {
        restore: async () => 'attempted',
        settleRestore: () => {},
      },
    }),
  }),
}))
vi.mock('./useSolanaWallets', () => ({ useSolanaWallets: () => [] }))
vi.mock('./useSolanaWalletConnect', () => ({
  useSolanaWalletConnect: () => ({
    enabled: false,
    wallet: null,
    error: null,
  }),
}))

beforeEach(() => {
  guard.mount.mockReset().mockReturnValue(guard.cleanup)
  guard.cleanup.mockReset()
  wagmi.connectors.value = []
  window.localStorage.setItem(
    'zerodev:solana:lastWallet',
    JSON.stringify({ name: 'MetaMask', source: 'standard' }),
  )
})

describe('useSolanaAutoReconnect', () => {
  it('mounts the EVM guard once for the saved wallet', () => {
    renderHook(() => useSolanaAutoReconnect())

    expect(guard.mount).toHaveBeenCalledTimes(1)
    expect(guard.mount).toHaveBeenCalledWith(
      wagmi.config,
      'MetaMask',
      wagmi.config.state.connections,
    )
  })

  it('keeps the same guard mounted when a connector announces itself late', () => {
    const { rerender } = renderHook(() => useSolanaAutoReconnect())

    // A remount would judge the host's later EVM connections by the
    // load-time record and sweep them away; following late connectors is
    // the guard's own job.
    wagmi.connectors.value = [{ id: 'io.rabby', name: 'Rabby' }]
    rerender()

    expect(guard.mount).toHaveBeenCalledTimes(1)
    expect(guard.cleanup).not.toHaveBeenCalled()
  })

  it('mounts no guard when the saved wallet is not an installed one', () => {
    window.localStorage.setItem(
      'zerodev:solana:lastWallet',
      JSON.stringify({ name: 'Phantom', source: 'walletconnect' }),
    )
    renderHook(() => useSolanaAutoReconnect())
    expect(guard.mount).not.toHaveBeenCalled()
  })

  it('tears the guard down when disabled', () => {
    const { rerender } = renderHook(
      ({ enabled }) => useSolanaAutoReconnect(enabled),
      { initialProps: { enabled: true } },
    )
    rerender({ enabled: false })
    expect(guard.cleanup).toHaveBeenCalledTimes(1)
  })
})
