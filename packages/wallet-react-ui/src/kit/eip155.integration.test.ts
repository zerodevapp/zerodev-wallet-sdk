/**
 * Boundary probes at the wagmi seam of the EVM adapter: what `disconnectEvm`
 * does when wagmi's own `disconnect` action rejects. The kit's test file
 * covers the happy path (every connection disconnected) and a single
 * connection that fails; neither sees what a failure does to the connections
 * queued behind it.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Config } from 'wagmi'
import { createStore } from '../store'
import { disconnectEvm } from './eip155'

const wagmi = {
  disconnect: vi.fn(
    async (_config: unknown, _params: { connector: { uid: string } }) => {},
  ),
}
vi.mock('@wagmi/core', () => ({
  connect: vi.fn(),
  reconnect: vi.fn(),
  disconnect: (...args: unknown[]) =>
    wagmi.disconnect(...(args as Parameters<typeof wagmi.disconnect>)),
}))

function connector(uid: string, name: string) {
  return { uid, id: name.toLowerCase(), name, type: 'injected' }
}

/** The slice of a wagmi Config `disconnectEvm` reads. */
function fakeConfig(...connectors: ReturnType<typeof connector>[]) {
  const connections = new Map(connectors.map((c) => [c.uid, { connector: c }]))
  return {
    state: { connections, current: connectors[0]?.uid ?? null },
    storage: {
      getItem: async () => null,
      setItem: async () => {},
      removeItem: async () => {},
    },
    connectors,
    subscribe: () => () => {},
    setState: () => {},
    _internal: { events: { change() {}, disconnect() {}, connect() {} } },
  } as unknown as Config
}

beforeEach(() => {
  wagmi.disconnect.mockReset().mockResolvedValue(undefined)
})

describe('disconnectEvm when wagmi rejects', () => {
  /**
   * LIVE DEFECT. `disconnectEvm` awaits `wagmiDisconnect` inside a bare
   * `for…of`, so the first rejection abandons the rest of the loop. Its own
   * docblock says "Disconnect every EVM connection", and the kit's
   * cross-namespace disconnect states the same intent for the two sides
   * ("Each side runs to the end even when the other fails"); within one
   * namespace that does not hold.
   *
   * Two reachable triggers in the installed wagmi 3.6.0. Its WalletConnect
   * connector rethrows everything from `provider.disconnect()` except "No
   * matching key", so an unreachable relay rejects; its injected connector
   * throws `ProviderNotFoundError` when `getProvider()` finds nothing, which
   * is an extension disabled or updated mid-session. Not
   * `wallet_revokePermissions`: that one is wrapped in a try/catch with a
   * timeout, so a locked wallet does not reject through it.
   *
   * wagmi's own `disconnect` awaits the connector before deleting the
   * connection, so a rejection leaves the connection in state as well.
   *
   * Change `it.fails` back to `it` when the loop settles each connector.
   */
  it.fails('attempts every connection even when one rejects', async () => {
    const gone = connector('mm', 'MetaMask')
    const rabby = connector('rb', 'Rabby')
    wagmi.disconnect.mockImplementation(async (_config, { connector: c }) => {
      if (c.uid === gone.uid) throw new Error('Provider not found')
    })

    await expect(
      disconnectEvm(
        { store: createStore(), config: fakeConfig(gone, rabby) },
        false,
      ),
    ).rejects.toThrow('Provider not found')

    expect(wagmi.disconnect.mock.calls.map((c) => c[1].connector.uid)).toEqual([
      gone.uid,
      rabby.uid,
    ])
  })
})
