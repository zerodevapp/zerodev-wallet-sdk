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

const atLoad = vi.hoisted(() => ({
  value: Promise.resolve([{ id: 'io.metamask', name: 'MetaMask' }]),
}))
vi.mock('../../shared/hooks/useKitStore', () => ({
  useKitStore: () => ({
    getState: () => ({
      evmConnectionsAtLoad: atLoad.value,
      solana: {
        restore: async () => 'attempted',
        settleRestore: () => {},
      },
    }),
  }),
}))
const solana = vi.hoisted(() => ({ wallets: [] as unknown[] }))
vi.mock('./useSolanaWallets', () => ({
  useSolanaWallets: () => solana.wallets,
}))
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
  solana.wallets = []
  window.localStorage.setItem(
    'zerodev:solana:lastWallet',
    JSON.stringify({ name: 'MetaMask', source: 'standard' }),
  )
})

describe('useSolanaAutoReconnect', () => {
  it("mounts the EVM guard once for the saved wallet, with the kit's record at load", () => {
    renderHook(() => useSolanaAutoReconnect())

    expect(guard.mount).toHaveBeenCalledTimes(1)
    expect(guard.mount).toHaveBeenCalledWith(
      wagmi.config,
      expect.objectContaining({ name: 'MetaMask' }),
      atLoad.value,
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

  it('hands the guard the icon off the registration when the saved record has none', () => {
    const logo = `data:image/svg+xml;base64,${'A'.repeat(96)}`
    const { rerender } = renderHook(() => useSolanaAutoReconnect())
    expect(guard.mount).toHaveBeenLastCalledWith(
      wagmi.config,
      { name: 'MetaMask', icon: undefined },
      atLoad.value,
    )

    // A record from before icons were kept; the wallet registers with one.
    solana.wallets = [{ name: 'MetaMask', icon: logo }]
    rerender()

    expect(guard.cleanup).toHaveBeenCalledTimes(1)
    expect(guard.mount).toHaveBeenCalledTimes(2)
    expect(guard.mount).toHaveBeenLastCalledWith(
      wagmi.config,
      { name: 'MetaMask', icon: logo },
      atLoad.value,
    )

    // Another registration changes nothing the guard is keyed on.
    solana.wallets = [...solana.wallets, { name: 'Phantom', icon: logo }]
    rerender()
    expect(guard.mount).toHaveBeenCalledTimes(2)
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
