/**
 * @vitest-environment happy-dom
 */
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SOLANA_CAIP2 } from '../../solana/walletconnect/chains'
import {
  type FakeWcProvider,
  fakeWcProvider,
  fakeWcSession,
} from '../../solana/walletconnect/fakeProvider.fixture'
import { base58 } from '../../solana/walletconnect/transaction'
import { getSolanaWalletConnectWallet } from '../../solana/walletconnect/wallet'
import { createStore } from '../../store'
import { useSolanaWalletConnectPairing } from './useSolanaWalletConnectPairing'

afterEach(cleanup)

let store = createStore()
vi.mock('../../shared/hooks/useKitStore', () => ({
  useKitStore: () => store,
}))
const goToStep = vi.fn()
vi.mock('./useAuth', () => ({ useAuth: () => ({ goToStep }) }))

const walletConnect = vi.hoisted(() => ({
  value: {
    enabled: true,
    wallet: null as unknown,
    error: null as string | null,
    retry: () => {},
  },
}))
vi.mock('../../solana/hooks/useSolanaWalletConnect', () => ({
  useSolanaWalletConnect: () => walletConnect.value,
}))

const ADDRESS = base58.encode(new Uint8Array(32).fill(1))

/** A provider whose pairing stays open until the test approves or fails it,
 * emitting the pairing URI as the real one does; wired into the mocked
 * discovery hook. */
function pairing() {
  const provider = fakeWcProvider()
  let settle: { resolve: () => void; reject: (err: Error) => void } | undefined
  provider.connect.mockImplementation(
    () =>
      new Promise<void>((resolve, reject) => {
        settle = { resolve, reject }
        provider.emit('display_uri', 'wc:abc@2?relay')
      }),
  )
  walletConnect.value = {
    enabled: true,
    wallet: getSolanaWalletConnectWallet(provider),
    error: null,
    retry: () => {},
  }
  return {
    provider: provider as FakeWcProvider,
    approve: () => {
      provider.session = fakeWcSession([`${SOLANA_CAIP2.mainnet}:${ADDRESS}`])
      settle?.resolve()
    },
    fail: (reason: Error | { code: number; message: string }) =>
      settle?.reject(reason as Error),
  }
}

beforeEach(() => {
  store = createStore()
  goToStep.mockClear()
  window.localStorage.clear()
})

describe('useSolanaWalletConnectPairing', () => {
  it('shows the pairing URI, then the approved session is in the store', async () => {
    const { approve } = pairing()
    const { result } = renderHook(() => useSolanaWalletConnectPairing())
    await waitFor(() => expect(result.current.uri).toBe('wc:abc@2?relay'))
    expect(store.getState().solana.status).toBe('connecting')

    await act(async () => approve())
    await waitFor(() => expect(goToStep).toHaveBeenCalledWith(null))
    const { status, connection } = store.getState().solana
    expect(status).toBe('connected')
    expect(connection?.source).toBe('walletconnect')
    expect(connection?.address).toBe(ADDRESS)
    expect(connection?.wallet.name).toBe('Phantom')
  })

  it('surfaces a failed proposal and retries on demand', async () => {
    const { fail } = pairing()
    const { result } = renderHook(() => useSolanaWalletConnectPairing())
    await waitFor(() => expect(result.current.uri).toBeTruthy())
    await act(async () => fail(new Error('Proposal expired')))
    await waitFor(() => expect(result.current.error).toBe('Proposal expired'))
    expect(store.getState().solana.status).toBe('disconnected')

    await act(async () => result.current.retry())
    await waitFor(() => expect(result.current.error).toBeNull())
    expect(result.current.uri).toBe('wc:abc@2?relay')
  })

  it('shows a raw WalletConnect rejection message, and a decline as "Connection declined"', async () => {
    const first = pairing()
    const { result, unmount } = renderHook(() =>
      useSolanaWalletConnectPairing(),
    )
    await waitFor(() => expect(result.current.uri).toBeTruthy())
    await act(async () =>
      first.fail({ code: 5100, message: 'Unsupported chains.' }),
    )
    await waitFor(() =>
      expect(result.current.error).toBe('Unsupported chains.'),
    )
    unmount()

    const second = pairing()
    const rendered = renderHook(() => useSolanaWalletConnectPairing())
    await waitFor(() => expect(rendered.result.current.uri).toBeTruthy())
    await act(async () =>
      second.fail({ code: 5000, message: 'User rejected.' }),
    )
    await waitFor(() =>
      expect(rendered.result.current.error).toBe('Connection declined'),
    )
  })

  it('retries the SDK load, not the pairing, after a failed load', () => {
    const retryLoad = vi.fn()
    walletConnect.value = {
      enabled: true,
      wallet: null,
      error: 'Failed to fetch',
      retry: retryLoad,
    }
    const { result } = renderHook(() => useSolanaWalletConnectPairing())
    expect(result.current.error).toBe('Failed to fetch')
    act(() => result.current.retry())
    expect(retryLoad).toHaveBeenCalledTimes(1)
  })

  it('abandons the proposal when deactivated, and proposes again when reactivated', async () => {
    const { provider } = pairing()
    const { result, rerender } = renderHook(
      ({ active }: { active: boolean }) =>
        useSolanaWalletConnectPairing(active),
      { initialProps: { active: true } },
    )
    await waitFor(() => expect(result.current.uri).toBeTruthy())
    rerender({ active: false })
    expect(provider.abortPairingAttempt).toHaveBeenCalledTimes(1)
    rerender({ active: true })
    expect(provider.connect).toHaveBeenCalledTimes(2)
  })

  it('abandons the proposal when unmounted mid-pairing', async () => {
    const { provider } = pairing()
    const { result, unmount } = renderHook(() =>
      useSolanaWalletConnectPairing(),
    )
    await waitFor(() => expect(result.current.uri).toBeTruthy())
    unmount()
    expect(provider.abortPairingAttempt).toHaveBeenCalledTimes(1)
  })
})
