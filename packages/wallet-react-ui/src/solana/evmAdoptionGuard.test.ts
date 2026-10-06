import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Config } from 'wagmi'
import { detachEvmConnection, withoutEvmAdoption } from './evmAdoptionGuard'

type Listener = (...args: unknown[]) => void

/** The slice of a wagmi Connector the guard touches. */
function fakeConnector(name: string) {
  const listeners = new Map<string, Set<Listener>>()
  return {
    uid: crypto.randomUUID(),
    id: name.toLowerCase(),
    name,
    type: 'injected',
    emitter: {
      on: (event: string, fn: Listener) => {
        listeners.set(event, (listeners.get(event) ?? new Set()).add(fn))
      },
      off: (event: string, fn: Listener) => {
        listeners.get(event)?.delete(fn)
      },
      listenerCount: (event: string) => listeners.get(event)?.size ?? 0,
    },
  }
}
type FakeConnector = ReturnType<typeof fakeConnector>

/** The slice of a wagmi Config the guard touches, with wagmi's own adoption
 * behaviour reproduced: a self-connect adds the connection, makes it
 * current, and attaches the change/disconnect listeners. */
function fakeConfig() {
  type State = {
    connections: Map<string, { connector: FakeConnector }>
    current: string | null
    status: 'connected' | 'disconnected'
  }
  let state: State = {
    connections: new Map(),
    current: null,
    status: 'disconnected',
  }
  const subscribers = new Set<(s: State['connections']) => void>()
  const events = {
    change: vi.fn(),
    disconnect: vi.fn(),
    connect: vi.fn(),
  }
  const storage = new Map<string, unknown>()
  const config = {
    storage: {
      getItem: async (key: string) => storage.get(key) ?? null,
      setItem: async (key: string, value: unknown) => {
        storage.set(key, value)
      },
      removeItem: async (key: string) => {
        storage.delete(key)
      },
    },
    get state() {
      return state
    },
    setState: (fn: (x: State) => State) => {
      const prev = state
      state = fn(state)
      if (state.connections !== prev.connections) {
        for (const s of subscribers) s(state.connections)
      }
    },
    subscribe: (
      _selector: (s: State) => State['connections'],
      listener: (s: State['connections']) => void,
    ) => {
      subscribers.add(listener)
      return () => subscribers.delete(listener)
    },
    _internal: { events },
  }
  const adopt = (connector: FakeConnector) => {
    // wagmi registers `connect` at connector setup and fails to remove it on
    // adoption (it calls off() with the change handler), so it is still there.
    connector.emitter.on('connect', events.connect)
    connector.emitter.on('change', events.change)
    connector.emitter.on('disconnect', events.disconnect)
    config.setState((x) => ({
      ...x,
      connections: new Map(x.connections).set(connector.uid, { connector }),
      current: connector.uid,
      status: 'connected',
    }))
  }
  return { config: config as unknown as Config, adopt, events, storage }
}

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('withoutEvmAdoption', () => {
  it('detaches the same wallet adopted during the Solana connect', async () => {
    const { config, adopt, events } = fakeConfig()
    const metamask = fakeConnector('MetaMask')

    const result = await withoutEvmAdoption(config, 'MetaMask', async () => {
      adopt(metamask)
      return 'ok'
    })

    expect(result).toBe('ok')
    expect(config.state.connections.size).toBe(0)
    expect(config.state.status).toBe('disconnected')
    expect(config.state.current).toBeNull()
    // Listeners wagmi attached on adoption are gone, and the self-connect
    // listener is not restored.
    expect(metamask.emitter.listenerCount('change')).toBe(0)
    expect(metamask.emitter.listenerCount('disconnect')).toBe(0)
    expect(metamask.emitter.listenerCount('connect')).toBe(0)
    expect(events.connect).not.toHaveBeenCalled()
  })

  it('detaches a late adoption inside the grace period, then stops watching', async () => {
    const { config, adopt } = fakeConfig()
    const phantom = fakeConnector('Phantom')

    await withoutEvmAdoption(config, 'Phantom', async () => undefined)
    adopt(phantom)
    expect(config.state.connections.size).toBe(0)

    vi.advanceTimersByTime(2000)
    adopt(phantom)
    // After the grace period the guard is gone; a later connect stands.
    expect(config.state.connections.size).toBe(1)
  })

  it('leaves other wallets and pre-existing connections alone', async () => {
    const { config, adopt } = fakeConfig()
    const rabby = fakeConnector('Rabby')
    const existing = fakeConnector('MetaMask')
    adopt(existing)

    await withoutEvmAdoption(config, 'MetaMask', async () => {
      adopt(rabby)
    })

    expect([...config.state.connections.keys()]).toEqual([
      existing.uid,
      rabby.uid,
    ])
    expect(config.state.status).toBe('connected')
  })

  it('still sweeps when the Solana connect rejects', async () => {
    const { config, adopt } = fakeConfig()
    const metamask = fakeConnector('MetaMask')

    await expect(
      withoutEvmAdoption(config, 'MetaMask', async () => {
        adopt(metamask)
        throw new Error('User rejected the request')
      }),
    ).rejects.toThrow('User rejected')
    expect(config.state.connections.size).toBe(0)
  })
})

describe('detachEvmConnection', () => {
  it('drops the connection, sets the shim and moves the recent pointer', async () => {
    const { config, adopt, storage } = fakeConfig()
    const metamask = fakeConnector('MetaMask')
    const rabby = fakeConnector('Rabby')
    adopt(rabby)
    adopt(metamask)
    storage.set('recentConnectorId', metamask.id)

    await detachEvmConnection(config, metamask.uid)

    expect([...config.state.connections.keys()]).toEqual([rabby.uid])
    expect(config.state.current).toBe(rabby.uid)
    expect(config.state.status).toBe('connected')
    expect(storage.get(`${metamask.id}.disconnected`)).toBe(true)
    expect(storage.get('recentConnectorId')).toBe(rabby.id)
    expect(metamask.emitter.listenerCount('change')).toBe(0)
    expect(metamask.emitter.listenerCount('connect')).toBe(0)
  })

  it('ends in the disconnected state when it was the only connection', async () => {
    const { config, adopt, storage } = fakeConfig()
    const metamask = fakeConnector('MetaMask')
    adopt(metamask)
    storage.set('recentConnectorId', metamask.id)

    await detachEvmConnection(config, metamask.uid)

    expect(config.state.connections.size).toBe(0)
    expect(config.state.current).toBeNull()
    expect(config.state.status).toBe('disconnected')
    expect(storage.has('recentConnectorId')).toBe(false)
  })
})
