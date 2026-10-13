/**
 * @vitest-environment happy-dom
 */
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from 'vitest'
import { SOLANA_CAIP2 } from '../../solana/walletconnect/chains'
import { base58 } from '../../solana/walletconnect/transaction'
import {
  getSolanaWalletConnectWallet,
  type SolanaWcProvider,
} from '../../solana/walletconnect/wallet'
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
  },
}))
vi.mock('../../solana/hooks/useSolanaWalletConnect', () => ({
  useSolanaWalletConnect: () => walletConnect.value,
}))

const ADDRESS = base58.encode(new Uint8Array(32).fill(1))

function fakeProvider() {
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>()
  let resolveConnect: (() => void) | undefined
  let rejectConnect: ((err: Error) => void) | undefined
  const provider: SolanaWcProvider & {
    emit: (event: string, ...args: unknown[]) => void
    approve: () => void
    fail: (message: string) => void
    abortPairingAttempt: Mock<() => void>
  } = {
    session: undefined,
    connect: () =>
      new Promise<void>((resolve, reject) => {
        resolveConnect = resolve
        rejectConnect = reject
        provider.emit('display_uri', 'wc:abc@2?relay')
      }),
    disconnect: async () => {},
    request: vi.fn(),
    abortPairingAttempt: vi.fn(),
    on: (event, listener) => {
      listeners.set(event, (listeners.get(event) ?? new Set()).add(listener))
    },
    off: (event, listener) => {
      listeners.get(event)?.delete(listener)
    },
    emit: (event, ...args) => {
      for (const l of listeners.get(event) ?? []) l(...args)
    },
    approve: () => {
      provider.session = {
        namespaces: {
          solana: { accounts: [`${SOLANA_CAIP2.mainnet}:${ADDRESS}`] },
        },
        peer: { metadata: { name: 'Phantom', icons: [] } },
      }
      resolveConnect?.()
    },
    fail: (message) => rejectConnect?.(new Error(message)),
  }
  return provider
}

beforeEach(() => {
  store = createStore()
  goToStep.mockClear()
  window.localStorage.clear()
})

describe('useSolanaWalletConnectPairing', () => {
  it('shows the pairing URI, then hands the approved session to the store', async () => {
    const provider = fakeProvider()
    walletConnect.value = {
      enabled: true,
      wallet: getSolanaWalletConnectWallet(provider),
      error: null,
    }
    const { result } = renderHook(() => useSolanaWalletConnectPairing())
    await waitFor(() => expect(result.current.uri).toBe('wc:abc@2?relay'))
    expect(store.getState().solana.status).toBe('disconnected')

    await act(async () => provider.approve())
    await waitFor(() => expect(goToStep).toHaveBeenCalledWith(null))
    expect(store.getState().solana.status).toBe('connected')
    expect(store.getState().solana.connection?.source).toBe('walletconnect')
    expect(store.getState().solana.connection?.address).toBe(ADDRESS)
    expect(store.getState().solana.connection?.wallet.name).toBe('Phantom')
  })

  it('surfaces a failed proposal and retries on demand', async () => {
    const provider = fakeProvider()
    walletConnect.value = {
      enabled: true,
      wallet: getSolanaWalletConnectWallet(provider),
      error: null,
    }
    const { result } = renderHook(() => useSolanaWalletConnectPairing())
    await waitFor(() => expect(result.current.uri).toBeTruthy())
    await act(async () => provider.fail('Proposal expired'))
    await waitFor(() => expect(result.current.error).toBe('Proposal expired'))

    await act(async () => result.current.retry())
    await waitFor(() => expect(result.current.error).toBeNull())
    expect(result.current.uri).toBe('wc:abc@2?relay')
  })

  it('abandons the proposal when unmounted mid-pairing', async () => {
    const provider = fakeProvider()
    walletConnect.value = {
      enabled: true,
      wallet: getSolanaWalletConnectWallet(provider),
      error: null,
    }
    const { result, unmount } = renderHook(() =>
      useSolanaWalletConnectPairing(),
    )
    await waitFor(() => expect(result.current.uri).toBeTruthy())
    unmount()
    expect(provider.abortPairingAttempt).toHaveBeenCalledTimes(1)
  })
})
