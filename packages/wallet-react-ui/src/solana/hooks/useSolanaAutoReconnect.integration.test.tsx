/**
 * @vitest-environment happy-dom
 *
 * The real hook under a real wagmi provider, mounted twice in one page load
 * (a second kit hook in another component, or a page remounting on
 * navigation), around an explicit EVM connect through the same wallet that
 * serves the Solana slot. The unit tests next door stub the guard; this one
 * runs it.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import { createConnector } from '@wagmi/core'
import type { ReactNode } from 'react'
import type { EIP1193Provider } from 'viem'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createConfig, createStorage, http, WagmiProvider } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'
import { connectEvm } from '../../kit/eip155'
import { createStore } from '../../store'
import {
  readEvmConnectionsAtLoad,
  withoutEvmAdoption,
} from '../evmAdoptionGuard'
import { useSolanaAutoReconnect } from './useSolanaAutoReconnect'

const ACCOUNT = '0x0000000000000000000000000000000000000001' as const
type Listener = (payload: unknown) => void

/** MetaMask's site permission: one grant covers Solana and EVM. */
function fakeMetaMask() {
  const wallet = { granted: false }
  const listeners = new Map<string, Set<Listener>>()
  const provider = {
    request: async ({ method }: { method: string }) => {
      switch (method) {
        case 'eth_accounts':
          return wallet.granted ? [ACCOUNT] : []
        case 'eth_requestAccounts':
          wallet.granted = true
          return [ACCOUNT]
        case 'eth_chainId':
          return `0x${mainnet.id.toString(16)}`
        default:
          throw new Error(`unexpected ${method}`)
      }
    },
    on: (event: string, fn: Listener) => {
      listeners.set(event, (listeners.get(event) ?? new Set()).add(fn))
    },
    removeListener: (event: string, fn: Listener) => {
      listeners.get(event)?.delete(fn)
    },
    emit: (event: string, payload: unknown) => {
      for (const fn of listeners.get(event) ?? []) fn(payload)
    },
  }
  return { wallet, provider }
}

const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve()
}

/** The demo's wagmi config in miniature: the kit connector reading the
 * load-time record inside its creator, MetaMask announced through 6963. */
function setup() {
  const backing = new Map<string, string>()
  const mm = fakeMetaMask()
  const store = createStore()
  const kit = createConnector((wagmiConfig) => {
    store
      .getState()
      .setEvmConnectionsAtLoad(readEvmConnectionsAtLoad(wagmiConfig.storage))
    return {
      id: 'zerodev-wallet',
      name: 'ZeroDev',
      type: 'injected',
      connect: async () => {
        throw new Error('not in this test')
      },
      disconnect: async () => {},
      getAccounts: async () => [],
      getChainId: async () => mainnet.id,
      getProvider: async () => undefined,
      isAuthorized: async () => false,
      onAccountsChanged: () => {},
      onChainChanged: () => {},
      onDisconnect: () => {},
      getKitStore: () => store,
    }
  })
  const config = createConfig({
    chains: [mainnet],
    connectors: [
      kit,
      injected({
        target: {
          id: 'io.metamask',
          name: 'MetaMask',
          provider: mm.provider as unknown as EIP1193Provider,
        },
      }),
    ],
    multiInjectedProviderDiscovery: false,
    ssr: true,
    transports: { [mainnet.id]: http() },
    storage: createStorage({
      storage: {
        getItem: (key) => backing.get(key) ?? null,
        setItem: (key, value) => {
          backing.set(key, value)
        },
        removeItem: (key) => {
          backing.delete(key)
        },
      },
    }),
  })
  const queryClient = new QueryClient()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  )
  const metamask = config.connectors.find((c) => c.id === 'io.metamask')
  if (!metamask) throw new Error('no MetaMask connector')
  return { mm, store, config, wrapper, metamask }
}

beforeEach(() => {
  vi.useFakeTimers()
  window.localStorage.clear()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('useSolanaAutoReconnect mounted twice in one page load', () => {
  it('keeps an explicit EVM connection made between the mounts', async () => {
    const { mm, store, config, wrapper, metamask } = setup()

    // Solana login through MetaMask: the saved wallet, and the EVM side
    // granted in the same prompt and held back.
    window.localStorage.setItem(
      'zerodev:solana:lastWallet',
      JSON.stringify({ name: 'MetaMask', source: 'standard' }),
    )
    await withoutEvmAdoption(config, 'MetaMask', async () => {
      mm.wallet.granted = true
      mm.provider.emit('accountsChanged', [ACCOUNT])
      await flush()
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })

    // The dashboard: first kit hook.
    const first = renderHook(() => useSolanaAutoReconnect(), { wrapper })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })
    expect(config.state.connections.size).toBe(0)

    // "Add an EVM wallet" with MetaMask, through the kit's connect.
    await act(async () => {
      await connectEvm({ store, config }, { wallet: metamask })
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })
    expect(config.state.connections.size).toBe(1)

    // Another component with its own kit hook.
    const second = renderHook(() => useSolanaAutoReconnect(), { wrapper })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })
    expect(config.state.connections.size).toBe(1)
    expect(config.state.status).toBe('connected')

    // The page remounting on navigation: the first hook is gone by then.
    first.unmount()
    second.unmount()
    const third = renderHook(() => useSolanaAutoReconnect(), { wrapper })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })
    third.unmount()
    expect(config.state.connections.size).toBe(1)
    expect(config.state.status).toBe('connected')
  })
})
