/**
 * Boundary probes at the wagmi seam of the EVM adapter, both about
 * `disconnectEvm`: what it does when wagmi's own `disconnect` action rejects,
 * and which branch it picks when one wallet serves both namespaces under two
 * different names. The kit's test file covers the happy path (every
 * connection disconnected) and a single connection that fails; neither sees
 * what a failure does to the connections queued behind it, and nothing
 * exercises the name match the keepSolana branch turns on.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Config } from 'wagmi'
import type { SolanaConnection } from '../solana/types'
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

const guard = { detachEvmConnection: vi.fn(async () => {}) }
vi.mock('../solana/evmAdoptionGuard.js', () => ({
  allowEvmConnection: vi.fn(),
  detachEvmConnection: (...args: unknown[]) =>
    guard.detachEvmConnection(
      ...(args as Parameters<typeof guard.detachEvmConnection>),
    ),
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

/**
 * A store whose Solana slot holds an installed (Wallet Standard) connection
 * under `name`. `disconnectEvm` reads only `source` and `wallet.name` off it,
 * so the rest of `SolanaConnection` is left out rather than faked.
 */
function storeWithSolanaWallet(name: string) {
  const store = createStore()
  store.setState((state) => ({
    ...state,
    solana: {
      ...state.solana,
      status: 'connected' as const,
      // Cast rather than fake an account, a public key and a chain list that
      // nothing on this path reads. Filling them in would assert a shape the
      // branch under test never looks at.
      connection: {
        source: 'standard',
        wallet: { name },
      } as unknown as SolanaConnection,
    },
  }))
  return store
}

beforeEach(() => {
  wagmi.disconnect.mockReset().mockResolvedValue(undefined)
  guard.detachEvmConnection.mockReset().mockResolvedValue(undefined)
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

/**
 * TC-27. The keepSolana branch pairs the two sides of one wallet by
 * case-insensitive display-name match, so what it does depends on a string the
 * wallet chooses twice, independently.
 */
describe('disconnectEvm pairing the two sides of one wallet', () => {
  /**
   * The control, and what makes the probe below mean anything: with the two
   * names equal the branch detaches instead of disconnecting. Without this,
   * a probe asserting `detach` could pass because `detach` is never reached
   * at all.
   */
  it('detaches rather than revoking when both sides agree on the name', async () => {
    const mm = connector('mm', 'MetaMask')

    await disconnectEvm(
      {
        store: storeWithSolanaWallet('MetaMask'),
        config: fakeConfig(mm),
      },
      true,
    )

    expect(guard.detachEvmConnection).toHaveBeenCalledTimes(1)
    expect(wagmi.disconnect).not.toHaveBeenCalled()
  })

  /**
   * LIVE DEFECT. One wallet, two registrations, two spellings: the EIP-6963
   * connector says "MetaMask" and the Wallet Standard wallet says "MetaMask
   * Wallet". `equalsIgnoreCase` finds no match, so the connection takes the
   * `wagmiDisconnect` branch, whose whole reason for existing is that it is
   * unsafe here: wagmi's disconnect asks the wallet to revoke, and a browser
   * wallet's revoke is site-wide, which ends the Solana session with it.
   *
   * `disconnectEvm`'s own docblock states the intent this breaks: "a connector
   * that serves the Solana slot too is detached at wagmi's state level instead
   * of disconnected". It serves the Solana slot either way. Only the label
   * differs, and the user loses a session over it.
   *
   * A display name is the wrong key for this. The wallet already hands over
   * two stable identifiers, the connector's `rdns` and the Wallet Standard
   * wallet's own identity, and neither is consulted.
   *
   * Change `it.fails` back to `it` when the pairing stops turning on the name.
   */
  it.fails(
    'detaches even when the two sides spell the name differently',
    async () => {
      const mm = connector('mm', 'MetaMask')

      await disconnectEvm(
        {
          store: storeWithSolanaWallet('MetaMask Wallet'),
          config: fakeConfig(mm),
        },
        true,
      )

      expect(guard.detachEvmConnection).toHaveBeenCalledTimes(1)
      expect(wagmi.disconnect).not.toHaveBeenCalled()
    },
  )
})
