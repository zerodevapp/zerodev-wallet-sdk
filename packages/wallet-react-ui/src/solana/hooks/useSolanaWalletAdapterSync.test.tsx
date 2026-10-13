/**
 * @vitest-environment happy-dom
 */
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createStore } from '../../store'
import type { SolanaStandardWallet } from '../types'
import {
  type SolanaWalletAdapter,
  useSolanaWalletAdapterSync,
} from './useSolanaWalletAdapterSync'

let store = createStore()
vi.mock('../../shared/hooks/useKitStore', () => ({
  useKitStore: () => store,
}))

function wallet(name: string) {
  return {
    version: '1.0.0',
    name,
    icon: 'data:image/svg+xml;base64,',
    chains: ['solana:mainnet'],
    accounts: [],
    features: {
      'standard:connect': {
        version: '1.0.0',
        connect: async () => ({
          accounts: [
            {
              address: '7S3P4HxJpyyigGzodYwHtCxZyUQe9JiBMHyRWXArAaKv',
              publicKey: new Uint8Array(32),
              chains: ['solana:mainnet'],
              features: [],
            },
          ],
        }),
      },
    },
  } as unknown as SolanaStandardWallet
}

/** A wallet-adapter double that behaves like its provider: `select` picks a
 * wallet by name, `connect` flips `connected`. */
function fakeAdapter() {
  const state: SolanaWalletAdapter = {
    wallet: null,
    connected: false,
    connecting: false,
    select: vi.fn((name) => {
      state.wallet = name ? { adapter: { name } } : null
    }),
    connect: vi.fn(async () => {
      state.connected = true
    }),
    disconnect: vi.fn(async () => {
      state.connected = false
    }),
  }
  return state
}

beforeEach(() => {
  store = createStore()
  window.localStorage.clear()
})

describe('useSolanaWalletAdapterSync', () => {
  it('selects then connects the kit wallet in the adapter, and mirrors disconnect', async () => {
    const adapter = fakeAdapter()
    const { rerender } = renderHook(() =>
      useSolanaWalletAdapterSync({ ...adapter }),
    )
    expect(adapter.select).not.toHaveBeenCalled()

    await act(async () => {
      await store.getState().solana.connect(wallet('Phantom'))
    })
    rerender()
    expect(adapter.select).toHaveBeenCalledWith('Phantom')
    // The adapter now reports the selection; the next render connects it.
    rerender()
    expect(adapter.connect).toHaveBeenCalledTimes(1)
    rerender()
    expect(adapter.connect).toHaveBeenCalledTimes(1)

    await act(async () => {
      await store.getState().solana.disconnect()
    })
    rerender()
    expect(adapter.disconnect).toHaveBeenCalledTimes(1)
  })

  it('leaves a wallet the app selected itself alone', async () => {
    const adapter = fakeAdapter()
    adapter.select('Solflare')
    adapter.connected = true
    const { rerender } = renderHook(() =>
      useSolanaWalletAdapterSync({ ...adapter }),
    )
    rerender()
    // Nothing connected in the kit: no select, no disconnect.
    expect(adapter.select).toHaveBeenCalledTimes(1)
    expect(adapter.disconnect).not.toHaveBeenCalled()
  })
})
