/**
 * @vitest-environment happy-dom
 *
 * The reload after a Solana login through MetaMask and a later, explicit
 * MetaMask connection on EVM: the EVM side has to come back. Two real wagmi
 * configs over one storage play the two page loads, with the demo's
 * `ssr: true` and its effect order. (Phantom on EVM survived the same reload
 * only because the guard is scoped to the saved Solana wallet's name.)
 */
import { createConnector, reconnect } from '@wagmi/core'
import type { EIP1193Provider } from 'viem'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createConfig, createStorage, http } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'
import {
  allowEvmConnection,
  type EvmConnectionAtLoad,
  guardDormantEvmSide,
  readEvmConnectionsAtLoad,
  withoutEvmAdoption,
} from './evmAdoptionGuard'

const ACCOUNT = '0x0000000000000000000000000000000000000001' as const
type Listener = (payload: unknown) => void

/** MetaMask's site permission: one grant covers Solana and EVM. */
function fakeMetaMask() {
  const wallet = { granted: false }
  const page = () => {
    const listeners = new Map<string, Set<Listener>>()
    return {
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
  }
  return { wallet, page }
}

const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve()
}

/**
 * One page load: wagmi's config over the shared storage, with MetaMask's
 * EIP-6963 connector and a stand-in for the kit connector that reads the
 * persisted record inside its creator, as `zeroDevWallet` does.
 */
function pageLoad(
  backing: Map<string, string>,
  provider: ReturnType<ReturnType<typeof fakeMetaMask>['page']>,
) {
  let atLoad: Promise<readonly EvmConnectionAtLoad[] | null> | undefined
  const kitStandIn = createConnector((wagmiConfig) => {
    atLoad = readEvmConnectionsAtLoad(wagmiConfig.storage)
    return {
      id: 'zerodev-wallet',
      name: 'ZeroDev',
      type: 'zerodev',
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
    }
  })
  const config = createConfig({
    chains: [mainnet],
    connectors: [
      kitStandIn,
      injected({
        target: {
          id: 'io.metamask',
          name: 'MetaMask',
          provider: provider as unknown as EIP1193Provider,
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
  if (!atLoad) throw new Error('wagmi did not invoke the connector creator')
  const metamask = config.connectors.find((c) => c.id === 'io.metamask')
  if (!metamask) throw new Error('no MetaMask connector')
  const shimKey = () =>
    [...backing.keys()].find((k) => k.endsWith('io.metamask.disconnected'))
  /** The wallet announcing its EVM accounts, as MetaMask does at startup. */
  const announceAccounts = async () => {
    provider.emit('accountsChanged', [ACCOUNT])
    await flush()
  }
  /** wagmi's Hydrate on mount: rehydrate, then the reconnect sweep. */
  const hydrate = async () => {
    const persist = (
      config._internal.store as unknown as {
        persist: { rehydrate(): Promise<void> | void }
      }
    ).persist
    await persist.rehydrate()
    return reconnect(config)
  }
  return { config, metamask, atLoad, shimKey, announceAccounts, hydrate }
}

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('reload after a Solana login and an explicit EVM connect through the same wallet', () => {
  it('keeps the EVM connection', async () => {
    const backing = new Map<string, string>()
    const mm = fakeMetaMask()

    // ---- page 1: landing, nothing granted yet.
    const p1 = pageLoad(backing, mm.page())
    await p1.hydrate()
    expect(p1.config.state.status).toBe('disconnected')

    // Solana login through MetaMask: one prompt grants both namespaces, and
    // the EVM provider announces its accounts.
    await withoutEvmAdoption(p1.config, 'MetaMask', async () => {
      mm.wallet.granted = true
      await p1.announceAccounts()
    })
    await vi.advanceTimersByTimeAsync(2000)
    expect(p1.config.state.connections.size).toBe(0)
    expect(p1.shimKey()).toBeDefined()

    // Client-side navigation to the dashboard mounts the guard.
    const stop1 = guardDormantEvmSide(p1.config, 'MetaMask', p1.atLoad)
    await vi.advanceTimersByTimeAsync(1500)
    expect(p1.config.state.connections.size).toBe(0)

    // "Add EVM" with MetaMask: the kit's connect path.
    const release = allowEvmConnection(p1.config, p1.metamask)
    await p1.config.storage?.removeItem(`${p1.metamask.id}.disconnected`)
    const silent = await reconnect(p1.config, { connectors: [p1.metamask] })
    release()
    expect(silent).toHaveLength(1)
    expect(p1.config.state.status).toBe('connected')
    await vi.advanceTimersByTimeAsync(3000)
    expect(p1.config.state.connections.size).toBe(1)
    expect(p1.shimKey()).toBeUndefined()
    stop1()

    // ---- page 2: reload. The connector creator reads the record while
    // wagmi builds the config; child effects (the guard) run before wagmi's
    // Hydrate; MetaMask announces at startup.
    const p2 = pageLoad(backing, mm.page())
    await expect(p2.atLoad).resolves.toEqual([
      { id: 'io.metamask', name: 'MetaMask' },
    ])
    const stop2 = guardDormantEvmSide(p2.config, 'MetaMask', p2.atLoad)
    const sweep = p2.hydrate()
    await p2.announceAccounts()
    await sweep
    await vi.advanceTimersByTimeAsync(3000)
    stop2()

    expect(p2.shimKey()).toBeUndefined()
    expect(p2.config.state.status).toBe('connected')
    expect(p2.config.state.connections.size).toBe(1)
  })

  it('still keeps a dormant EVM side out when nothing connected it', async () => {
    const backing = new Map<string, string>()
    const mm = fakeMetaMask()

    const p1 = pageLoad(backing, mm.page())
    await p1.hydrate()
    await withoutEvmAdoption(p1.config, 'MetaMask', async () => {
      mm.wallet.granted = true
      await p1.announceAccounts()
    })
    await vi.advanceTimersByTimeAsync(2000)
    const stop1 = guardDormantEvmSide(p1.config, 'MetaMask', p1.atLoad)
    await vi.advanceTimersByTimeAsync(1500)
    stop1()
    expect(p1.config.state.connections.size).toBe(0)

    const p2 = pageLoad(backing, mm.page())
    await expect(p2.atLoad).resolves.toEqual([])
    const stop2 = guardDormantEvmSide(p2.config, 'MetaMask', p2.atLoad)
    const sweep = p2.hydrate()
    await p2.announceAccounts()
    await sweep
    await vi.advanceTimersByTimeAsync(3000)
    stop2()

    expect(p2.config.state.connections.size).toBe(0)
    expect(p2.config.state.status).toBe('disconnected')
    expect(p2.shimKey()).toBeDefined()
  })
})

describe('a guard mounted again after an explicit EVM connect, in the same page load', () => {
  it('keeps the connection: the sweep is judged once per page load', async () => {
    const backing = new Map<string, string>()
    const mm = fakeMetaMask()

    const p1 = pageLoad(backing, mm.page())
    await p1.hydrate()
    await withoutEvmAdoption(p1.config, 'MetaMask', async () => {
      mm.wallet.granted = true
      await p1.announceAccounts()
    })
    await vi.advanceTimersByTimeAsync(2000)

    // The dashboard's kit hook mounts the guard; the sweep is long over.
    const stop1 = guardDormantEvmSide(p1.config, 'MetaMask', p1.atLoad)
    await vi.advanceTimersByTimeAsync(1500)

    // "Add EVM" with MetaMask: the kit's connect path.
    const release = allowEvmConnection(p1.config, p1.metamask)
    await p1.config.storage?.removeItem(`${p1.metamask.id}.disconnected`)
    await reconnect(p1.config, { connectors: [p1.metamask] })
    release()
    await vi.advanceTimersByTimeAsync(3000)
    expect(p1.config.state.connections.size).toBe(1)

    // Navigation remounts the page, or another component mounts its own
    // kit hook: a second guard on the same config.
    stop1()
    const stop2 = guardDormantEvmSide(p1.config, 'MetaMask', p1.atLoad)
    await vi.advanceTimersByTimeAsync(3000)
    stop2()

    expect(p1.config.state.connections.size).toBe(1)
    expect(p1.config.state.status).toBe('connected')
    expect(p1.shimKey()).toBeUndefined()
  })
})

describe('the first guard mounts after an explicit EVM connect, in the same page load', () => {
  it('keeps the connection: explicit ownership outlives the connect', async () => {
    const backing = new Map<string, string>()
    const mm = fakeMetaMask()

    const p1 = pageLoad(backing, mm.page())
    await p1.hydrate()
    await withoutEvmAdoption(p1.config, 'MetaMask', async () => {
      mm.wallet.granted = true
      await p1.announceAccounts()
    })
    await vi.advanceTimersByTimeAsync(2000)

    // "Add EVM" with MetaMask through the kit's connect path, before any
    // guard has mounted (the host's hook had `reconnectOnMount: false`).
    const release = allowEvmConnection(p1.config, p1.metamask)
    await p1.config.storage?.removeItem(`${p1.metamask.id}.disconnected`)
    await reconnect(p1.config, { connectors: [p1.metamask] })
    release()
    expect(p1.config.state.connections.size).toBe(1)

    // Navigation mounts the first guard, with the load-time record.
    const stop = guardDormantEvmSide(p1.config, 'MetaMask', p1.atLoad)
    await vi.advanceTimersByTimeAsync(3000)
    stop()

    expect(p1.config.state.connections.size).toBe(1)
    expect(p1.config.state.status).toBe('connected')
  })
})
