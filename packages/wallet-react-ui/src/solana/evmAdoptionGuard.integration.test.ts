/**
 * @vitest-environment happy-dom
 *
 * The guard reaches into wagmi's config internals (`_internal.events`, the
 * connector emitters) and mirrors its disconnect action. The unit tests use
 * a hand-written config, so a wagmi release that moves those internals
 * would pass them and break the guard in production. This runs the same
 * scenarios through `createConfig` itself.
 */
import { reconnect } from '@wagmi/core'
import type { EIP1193Provider } from 'viem'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createConfig, createStorage, http } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { injected, mock } from 'wagmi/connectors'
import {
  detachEvmConnection,
  guardDormantEvmSide,
  muteDormantEvmSide,
  withoutEvmAdoption,
} from './evmAdoptionGuard'

const ACCOUNT = '0x0000000000000000000000000000000000000001' as const

function realConfig() {
  const backing = new Map<string, string>()
  const config = createConfig({
    chains: [mainnet],
    connectors: [mock({ accounts: [ACCOUNT] })],
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
  const connector = config.connectors[0]
  if (!connector) throw new Error('no connector')
  // What an injected wallet does when it "connects itself": its connector
  // emits `connect`, and wagmi's own handler adopts it into the state.
  const selfConnect = () =>
    connector.emitter.emit('connect', {
      accounts: [ACCOUNT],
      chainId: mainnet.id,
    })
  return { config, connector, selfConnect, backing }
}

type ProviderListener = (payload: unknown) => void

/**
 * A multichain wallet's EVM provider after a reload: the site is authorised
 * (the Solana login granted both namespaces in one prompt), so `eth_accounts`
 * answers at once, and the provider announces its accounts on its own
 * through `accountsChanged`, as MetaMask does at startup.
 */
function fakeProvider() {
  const listeners = new Map<string, Set<ProviderListener>>()
  return {
    request: async ({ method }: { method: string }) => {
      switch (method) {
        case 'eth_accounts':
        case 'eth_requestAccounts':
          return [ACCOUNT]
        case 'eth_chainId':
          return `0x${mainnet.id.toString(16)}`
        default:
          throw new Error(`unexpected ${method}`)
      }
    },
    on: (event: string, fn: ProviderListener) => {
      listeners.set(event, (listeners.get(event) ?? new Set()).add(fn))
    },
    removeListener: (event: string, fn: ProviderListener) => {
      listeners.get(event)?.delete(fn)
    },
    emit: (event: string, payload: unknown) => {
      for (const fn of listeners.get(event) ?? []) fn(payload)
    },
  }
}

/**
 * The page after a reload that follows a Solana login through MetaMask: a
 * fresh wagmi config whose only EVM connector is MetaMask's EIP-6963 one,
 * carrying the `disconnected` shim the Solana connect wrote.
 */
function reloadedConfig() {
  const backing = new Map<string, string>()
  const provider = fakeProvider()
  const config = createConfig({
    chains: [mainnet],
    connectors: [
      injected({
        target: {
          id: 'io.metamask',
          name: 'MetaMask',
          // A stub answering three methods cannot satisfy the EIP-1193
          // `request` generic; the connector only ever calls those three.
          provider: provider as unknown as EIP1193Provider,
        },
      }),
    ],
    multiInjectedProviderDiscovery: false,
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
  const connector = config.connectors[0]
  if (!connector) throw new Error('no connector')
  const shimKey = () =>
    [...backing.keys()].find((k) => k.endsWith(`${connector.id}.disconnected`))
  return {
    config,
    connector,
    backing,
    shimKey,
    shim: async () => {
      await config.storage?.setItem(`${connector.id}.disconnected`, true)
    },
    // The wallet announcing its EVM accounts. The connector's handler is
    // async: give it the microtasks it needs.
    announceAccounts: async () => {
      provider.emit('accountsChanged', [ACCOUNT])
      for (let i = 0; i < 10; i++) await Promise.resolve()
    },
  }
}

const timers: ReturnType<typeof setTimeout>[] = []
afterEach(() => {
  for (const t of timers) clearTimeout(t)
})

describe('evmAdoptionGuard against a real wagmi config', () => {
  it('a self-connect is adopted by wagmi (the simulation is faithful)', () => {
    const { config, selfConnect } = realConfig()
    selfConnect()
    expect(config.state.connections.size).toBe(1)
    expect(config.state.status).toBe('connected')
  })

  it('withoutEvmAdoption detaches the adoption and leaves wagmi disconnected', async () => {
    const { config, connector, selfConnect } = realConfig()
    await withoutEvmAdoption(config, connector.name, async () => {
      selfConnect()
    })
    expect(config.state.connections.size).toBe(0)
    expect(config.state.current).toBeNull()
    expect(config.state.status).toBe('disconnected')
    // wagmi's handlers are off the connector, so a later self-connect does
    // not re-adopt either.
    selfConnect()
    expect(config.state.connections.size).toBe(0)
  })

  it('after a reload, the shim keeps the reconnect sweep off MetaMask but an accounts announcement still adopts it (the bug)', async () => {
    const { config, shim, shimKey, announceAccounts } = reloadedConfig()
    await shim()
    expect(await reconnect(config)).toEqual([])
    expect(config.state.status).toBe('disconnected')

    await announceAccounts()

    // wagmi adopts the EVM side nobody asked for, and clears the one thing
    // that kept the sweep off it.
    expect(config.state.connections.size).toBe(1)
    expect(config.state.status).toBe('connected')
    expect(shimKey()).toBeUndefined()
  })

  it('muteDormantEvmSide at mount keeps the announcement from adopting, shim intact', async () => {
    const { config, connector, shim, shimKey, announceAccounts } =
      reloadedConfig()
    await shim()
    muteDormantEvmSide(config, connector.name)
    expect(await reconnect(config)).toEqual([])

    await announceAccounts()

    expect(config.state.connections.size).toBe(0)
    expect(config.state.status).toBe('disconnected')
    expect(shimKey()).toBeDefined()
  })

  it('guardDormantEvmSide mounted before the sweep: the shim keeps MetaMask out, with no shim saved', async () => {
    // The shim the Solana connect wrote was deleted by the wallet's own
    // accounts announcement, so storage holds nothing for MetaMask.
    const { config, connector, shimKey } = reloadedConfig()
    expect(shimKey()).toBeUndefined()

    const stop = guardDormantEvmSide(config, connector.name, null)
    expect(await reconnect(config)).toEqual([])
    stop()

    expect(config.state.connections.size).toBe(0)
    expect(config.state.status).toBe('disconnected')
    expect(shimKey()).toBeDefined()
  })

  it('guardDormantEvmSide mounted after the sweep adopted MetaMask: detaches it', async () => {
    vi.useFakeTimers()
    try {
      const { config, connector, shimKey } = reloadedConfig()
      await reconnect(config)
      expect(config.state.status).toBe('connected')

      // The hook read the restored connections at its first render, before
      // the sweep: none. (wagmi has since persisted the adoption, so the
      // record is no guide here.)
      const stop = guardDormantEvmSide(config, connector.name, new Map())
      await vi.advanceTimersByTimeAsync(1000)
      stop()

      expect(config.state.connections.size).toBe(0)
      expect(config.state.status).toBe('disconnected')
      expect(shimKey()).toBeDefined()
    } finally {
      vi.useRealTimers()
    }
  })

  it('guardDormantEvmSide leaves MetaMask alone when wagmi persisted it as connected', async () => {
    const { config, connector } = reloadedConfig()
    // An explicit EVM connection before the reload: wagmi persisted it.
    await reconnect(config)
    expect(config.state.status).toBe('connected')
    // A fresh guard on this page reads that record (`restored` null, as
    // under ssr) and must not touch the connection.
    const stop = guardDormantEvmSide(config, connector.name, null)
    for (let i = 0; i < 10; i++) await Promise.resolve()
    stop()

    expect(config.state.connections.size).toBe(1)
    expect(config.state.status).toBe('connected')
  })

  it('a muted connector still connects when asked for explicitly', async () => {
    const { config, connector, shim } = reloadedConfig()
    await shim()
    muteDormantEvmSide(config, connector.name)

    // What the kit's EVM connect does: clear the shim, then wagmi's own
    // silent reconnect for that one connector.
    await config.storage?.removeItem(`${connector.id}.disconnected`)
    const silent = await reconnect(config, { connectors: [connector] })

    expect(silent).toHaveLength(1)
    expect(config.state.status).toBe('connected')
    expect(config.state.current).toBe(connector.uid)
  })

  it('detachEvmConnection drops a connection and writes the disconnected shim', async () => {
    const { config, connector, selfConnect, backing } = realConfig()
    selfConnect()
    expect(config.state.connections.size).toBe(1)
    await detachEvmConnection(config, connector.uid)
    expect(config.state.connections.size).toBe(0)
    expect(config.state.status).toBe('disconnected')
    expect(
      [...backing.keys()].some((k) =>
        k.endsWith(`${connector.id}.disconnected`),
      ),
    ).toBe(true)
  })
})
