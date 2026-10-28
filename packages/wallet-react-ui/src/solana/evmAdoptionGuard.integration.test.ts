/**
 * @vitest-environment happy-dom
 *
 * The guard reaches into wagmi's config internals (`_internal.events`, the
 * connector emitters) and mirrors its disconnect action. The unit tests use
 * a hand-written config, so a wagmi release that moves those internals
 * would pass them and break the guard in production. This runs the same
 * scenarios through `createConfig` itself.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { createConfig, createStorage, http } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { mock } from 'wagmi/connectors'
import { detachEvmConnection, withoutEvmAdoption } from './evmAdoptionGuard'

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
