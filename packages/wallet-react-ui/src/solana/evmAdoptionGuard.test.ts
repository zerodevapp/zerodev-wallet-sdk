import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Config } from 'wagmi'
import {
  allowEvmConnection,
  detachEvmConnection,
  guardDormantEvmSide,
  muteDormantEvmSide,
  revokeDormantEvmSide,
  withoutEvmAdoption,
} from './evmAdoptionGuard'

type Listener = (...args: unknown[]) => void

/** The slice of a wagmi Connector the guard touches. */
function fakeConnector(name: string) {
  const listeners = new Map<string, Set<Listener>>()
  return {
    uid: crypto.randomUUID(),
    id: name.toLowerCase(),
    name,
    type: 'injected',
    disconnect: vi.fn(async () => {}),
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
    status: 'connected' | 'connecting' | 'disconnected' | 'reconnecting'
  }
  let state: State = {
    connections: new Map(),
    current: null,
    status: 'disconnected',
  }
  type Subscriber = {
    selector: (s: State) => unknown
    listener: (value: unknown) => void
  }
  const subscribers = new Set<Subscriber>()
  const events = {
    change: vi.fn(),
    disconnect: vi.fn(),
    connect: vi.fn(),
  }
  const storage = new Map<string, unknown>()
  const connectors: FakeConnector[] = []
  const config = {
    connectors,
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
      for (const { selector, listener } of subscribers) {
        if (selector(state) !== selector(prev)) listener(selector(state))
      }
    },
    subscribe: (
      selector: (s: State) => unknown,
      listener: (value: unknown) => void,
    ) => {
      const entry = { selector, listener }
      subscribers.add(entry)
      return () => subscribers.delete(entry)
    },
    _internal: { events },
  }
  /** wagmi's reload reconnect: `connecting` while it sweeps, then the
   * adoptions it made land, then the status settles. */
  const sweep = (adopted: FakeConnector[]) => {
    config.setState((x) => ({ ...x, status: 'connecting' }))
    // Placed one by one, the status settling only at the end, as in wagmi.
    for (const c of adopted) place(c)
    config.setState((x) => ({
      ...x,
      status: x.connections.size > 0 ? 'connected' : 'disconnected',
    }))
  }
  const attach = (connector: FakeConnector) => {
    // wagmi registers `connect` at connector setup and fails to remove it on
    // adoption (it calls off() with the change handler), so it is still there.
    connector.emitter.on('connect', events.connect)
    connector.emitter.on('change', events.change)
    connector.emitter.on('disconnect', events.disconnect)
  }
  /** A self-connect: wagmi's handler places the connection and reports
   * connected in one update. */
  const adopt = (connector: FakeConnector) => {
    attach(connector)
    config.setState((x) => ({
      ...x,
      connections: new Map(x.connections).set(connector.uid, { connector }),
      current: connector.uid,
      status: 'connected',
    }))
  }
  /** A connection the reload reconnect made: placed without touching the
   * status, which it settles once at the end. */
  const place = (connector: FakeConnector) => {
    attach(connector)
    config.setState((x) => ({
      ...x,
      connections: new Map(x.connections).set(connector.uid, { connector }),
      current: connector.uid,
    }))
  }
  return {
    config: config as unknown as Config,
    adopt,
    sweep,
    events,
    storage,
    connectors,
  }
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

  it("shims the same wallet's dormant EVM connector after a Solana connect", async () => {
    const { config, storage, connectors } = fakeConfig()
    const metamask = fakeConnector('MetaMask')
    const rabby = fakeConnector('Rabby')
    connectors.push(metamask, rabby)

    await withoutEvmAdoption(config, 'metamask', async () => undefined)

    // wagmi's reload reconnect adopts any authorised injected connector;
    // the shim is what keeps MetaMask's EVM side out after a Solana login.
    expect(storage.get(`${metamask.id}.disconnected`)).toBe(true)
    expect(storage.has(`${rabby.id}.disconnected`)).toBe(false)
  })

  it('leaves the shim alone for a wallet connected on the EVM side', async () => {
    const { config, adopt, storage, connectors } = fakeConfig()
    const metamask = fakeConnector('MetaMask')
    connectors.push(metamask)
    adopt(metamask)

    await withoutEvmAdoption(config, 'MetaMask', async () => undefined)

    expect(storage.has(`${metamask.id}.disconnected`)).toBe(false)
    expect(config.state.connections.size).toBe(1)
  })

  it('sets no shim when the Solana connect rejects', async () => {
    const { config, storage, connectors } = fakeConfig()
    const metamask = fakeConnector('MetaMask')
    connectors.push(metamask)

    await expect(
      withoutEvmAdoption(config, 'MetaMask', async () => {
        throw new Error('User rejected the request')
      }),
    ).rejects.toThrow('User rejected')
    expect(storage.has(`${metamask.id}.disconnected`)).toBe(false)
  })

  it('keeps an EVM connection the host asked for inside the grace period', async () => {
    const { config, adopt } = fakeConfig()
    const phantom = fakeConnector('Phantom')
    await withoutEvmAdoption(config, 'Phantom', async () => undefined)

    // The host connects the EVM side on purpose right after: declared, so
    // the guard's grace sweep does not read it as an adoption.
    const release = allowEvmConnection(phantom)
    adopt(phantom)
    release()
    vi.advanceTimersByTime(2000)
    expect(config.state.connections.size).toBe(1)
    expect(config.state.status).toBe('connected')
  })

  it('keeps an explicit EVM connection that settled while the Solana prompt stayed open', async () => {
    const { config, adopt } = fakeConfig()
    const phantom = fakeConnector('Phantom')
    let approve!: () => void
    const prompt = new Promise<void>((resolve) => {
      approve = resolve
    })
    const guarded = withoutEvmAdoption(config, 'Phantom', () => prompt)

    // The host's EVM connect lands and settles (its exemption ends) long
    // before the user answers the Solana prompt.
    const release = allowEvmConnection(phantom)
    adopt(phantom)
    release()
    vi.advanceTimersByTime(60_000)
    expect(config.state.connections.size).toBe(1)

    approve()
    await guarded
    vi.advanceTimersByTime(2000)
    expect(config.state.connections.size).toBe(1)
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

describe('muteDormantEvmSide', () => {
  /** A fresh config after a reload: wagmi's connector setup put its
   * self-connect listener on every injected connector. */
  const armed = (connector: FakeConnector, events: { connect: Listener }) =>
    connector.emitter.on('connect', events.connect)

  it("takes wagmi's self-connect listener off the same wallet's dormant connector", () => {
    const { config, events, connectors } = fakeConfig()
    const metamask = fakeConnector('MetaMask')
    const rabby = fakeConnector('Rabby')
    connectors.push(metamask, rabby)
    armed(metamask, events)
    armed(rabby, events)

    muteDormantEvmSide(config, 'metamask')

    expect(metamask.emitter.listenerCount('connect')).toBe(0)
    expect(rabby.emitter.listenerCount('connect')).toBe(1)
  })

  it('leaves a wallet connected on the EVM side alone', () => {
    const { config, events, adopt, connectors } = fakeConfig()
    const metamask = fakeConnector('MetaMask')
    connectors.push(metamask)
    adopt(metamask)
    const before = metamask.emitter.listenerCount('connect')
    expect(before).toBeGreaterThan(0)

    muteDormantEvmSide(config, 'MetaMask')

    expect(metamask.emitter.listenerCount('connect')).toBe(before)
    expect(events.connect).not.toHaveBeenCalled()
  })

  it('skips the generic injected and kit connectors', () => {
    const { config, events, connectors } = fakeConfig()
    const generic = { ...fakeConnector('Injected'), id: 'injected' }
    const kit = { ...fakeConnector('ZeroDev'), id: 'zerodev-wallet' }
    connectors.push(generic, kit)
    armed(generic, events)
    armed(kit, events)

    muteDormantEvmSide(config, 'Injected')
    muteDormantEvmSide(config, 'ZeroDev')

    expect(generic.emitter.listenerCount('connect')).toBe(1)
    expect(kit.emitter.listenerCount('connect')).toBe(1)
  })
})

describe('guardDormantEvmSide', () => {
  /** The connector as wagmi persists it: the restored map after a reload. */
  const restored = (...connectors: FakeConnector[]) =>
    new Map(
      connectors.map((c) => [c.uid, { connector: c }]),
    ) as unknown as Config['state']['connections']
  const flush = () => vi.advanceTimersByTimeAsync(0)

  it('writes the shim and mutes the dormant side ahead of the sweep', async () => {
    const { config, events, storage, connectors } = fakeConfig()
    const metamask = fakeConnector('MetaMask')
    connectors.push(metamask)
    metamask.emitter.on('connect', events.connect)

    guardDormantEvmSide(config, 'MetaMask', restored())
    await flush()

    expect(storage.get(`${metamask.id}.disconnected`)).toBe(true)
    expect(metamask.emitter.listenerCount('connect')).toBe(0)
  })

  it('detaches what the sweep adopted once it settles', async () => {
    const { config, sweep, storage, connectors } = fakeConfig()
    const metamask = fakeConnector('MetaMask')
    const rabby = fakeConnector('Rabby')
    connectors.push(metamask, rabby)

    guardDormantEvmSide(config, 'MetaMask', restored())
    await flush()
    // The shim did not keep the sweep off (it was deleted earlier): both
    // connectors come back, Rabby on purpose.
    sweep([rabby, metamask])
    await flush()

    expect([...config.state.connections.keys()]).toEqual([rabby.uid])
    expect(config.state.current).toBe(rabby.uid)
    expect(config.state.status).toBe('connected')
    expect(storage.get(`${metamask.id}.disconnected`)).toBe(true)
  })

  it('ends in the disconnected state when the adoption was the only connection', async () => {
    const { config, sweep, connectors } = fakeConfig()
    const metamask = fakeConnector('MetaMask')
    connectors.push(metamask)

    guardDormantEvmSide(config, 'MetaMask', restored())
    await flush()
    sweep([metamask])
    await flush()

    expect(config.state.connections.size).toBe(0)
    expect(config.state.status).toBe('disconnected')
  })

  it('leaves a wallet that was connected on the EVM side at load alone', async () => {
    const { config, sweep, storage, connectors } = fakeConfig()
    const metamask = fakeConnector('MetaMask')
    connectors.push(metamask)

    guardDormantEvmSide(config, 'MetaMask', restored(metamask))
    await flush()
    sweep([metamask])
    await flush()

    expect(config.state.connections.size).toBe(1)
    expect(storage.has(`${metamask.id}.disconnected`)).toBe(false)
  })

  it("reads wagmi's persisted record when the restored map is not available (ssr)", async () => {
    const { config, sweep, storage, connectors } = fakeConfig()
    const metamask = fakeConnector('MetaMask')
    connectors.push(metamask)
    storage.set('store', { state: { connections: restored(metamask) } })

    guardDormantEvmSide(config, 'MetaMask', null)
    await flush()
    sweep([metamask])
    await flush()

    expect(config.state.connections.size).toBe(1)
    expect(storage.has(`${metamask.id}.disconnected`)).toBe(false)
  })

  it('treats a missing persisted record as dormant', async () => {
    const { config, sweep, connectors } = fakeConfig()
    const metamask = fakeConnector('MetaMask')
    connectors.push(metamask)

    guardDormantEvmSide(config, 'MetaMask', null)
    await flush()
    sweep([metamask])
    await flush()

    expect(config.state.connections.size).toBe(0)
  })

  it('detaches an adoption that landed before it mounted, once no sweep begins', async () => {
    const { config, sweep, connectors } = fakeConfig()
    const metamask = fakeConnector('MetaMask')
    connectors.push(metamask)
    sweep([metamask])
    expect(config.state.status).toBe('connected')

    guardDormantEvmSide(config, 'MetaMask', restored())
    await flush()
    expect(config.state.connections.size).toBe(1)
    await vi.advanceTimersByTimeAsync(1000)

    expect(config.state.connections.size).toBe(0)
  })

  it('keeps a connection the host asked for during the sweep', async () => {
    const { config, sweep, connectors } = fakeConfig()
    const metamask = fakeConnector('MetaMask')
    connectors.push(metamask)

    guardDormantEvmSide(config, 'MetaMask', restored())
    await flush()
    const release = allowEvmConnection(metamask)
    sweep([metamask])
    await flush()
    release()

    expect(config.state.connections.size).toBe(1)
  })

  it('does nothing after its cleanup', async () => {
    const { config, sweep, connectors } = fakeConfig()
    const metamask = fakeConnector('MetaMask')
    connectors.push(metamask)

    const stop = guardDormantEvmSide(config, 'MetaMask', restored())
    await flush()
    stop()
    sweep([metamask])
    await flush()
    await vi.advanceTimersByTimeAsync(1000)

    expect(config.state.connections.size).toBe(1)
  })
})

describe('revokeDormantEvmSide', () => {
  it("disconnects the same wallet's injected connector when nothing is connected through it", async () => {
    const { config, connectors } = fakeConfig()
    const metamask = fakeConnector('MetaMask')
    const rabby = fakeConnector('Rabby')
    connectors.push(metamask, rabby)

    await revokeDormantEvmSide(config, 'MetaMask')

    expect(metamask.disconnect).toHaveBeenCalled()
    expect(rabby.disconnect).not.toHaveBeenCalled()
  })

  it('falls back to the shim when the connector cannot disconnect', async () => {
    const { config, storage, connectors } = fakeConfig()
    const metamask = fakeConnector('MetaMask')
    metamask.disconnect.mockRejectedValueOnce(new Error('Provider not found'))
    connectors.push(metamask)

    await revokeDormantEvmSide(config, 'MetaMask')

    expect(storage.get(`${metamask.id}.disconnected`)).toBe(true)
  })

  it('keeps a wallet that is connected on the EVM side', async () => {
    const { config, adopt, connectors } = fakeConfig()
    const metamask = fakeConnector('MetaMask')
    connectors.push(metamask)
    adopt(metamask)

    await revokeDormantEvmSide(config, 'MetaMask')

    expect(metamask.disconnect).not.toHaveBeenCalled()
    expect(config.state.connections.size).toBe(1)
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
