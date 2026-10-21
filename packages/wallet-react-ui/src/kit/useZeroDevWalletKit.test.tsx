/**
 * @vitest-environment happy-dom
 */
import { act, cleanup, renderHook } from '@testing-library/react'
import type { WalletAccount } from '@wallet-standard/base'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthFlowDismissedError } from '../auth/utils/isCancellationError'
import type { SolanaStandardWallet } from '../solana/types'
import { createStore } from '../store'
import { useZeroDevWalletKit } from './useZeroDevWalletKit'

afterEach(cleanup)

// --- wagmi stand-ins -------------------------------------------------------

type FakeConnector = {
  uid: string
  id: string
  name: string
  type: string
  icon?: string
  getKitStore?: () => unknown
}

let store = createStore()
const kitConnector: FakeConnector = {
  uid: 'kit',
  id: 'zerodev-wallet',
  name: 'ZeroDev',
  type: 'injected',
  getKitStore: () => store,
}
const metamask: FakeConnector = {
  uid: 'mm',
  id: 'io.metamask',
  name: 'MetaMask',
  type: 'injected',
}
const rabby: FakeConnector = {
  uid: 'rb',
  id: 'io.rabby',
  name: 'Rabby',
  type: 'injected',
}

const storage = new Map<string, unknown>()
const events = { change() {}, disconnect() {}, connect() {} }
function makeConfig() {
  const state = {
    connections: new Map<
      string,
      { connector: FakeConnector & { emitter: { off: () => void } } }
    >(),
    current: null as string | null,
    status: 'disconnected' as string,
  }
  return {
    connectors: [
      kitConnector,
      metamask,
      rabby,
      { uid: 'inj', id: 'injected', name: 'Injected', type: 'injected' },
    ],
    state,
    setState: (fn: (s: typeof state) => typeof state) => {
      Object.assign(state, fn(state))
    },
    subscribe: () => () => {},
    storage: {
      getItem: async (k: string) => storage.get(k) ?? null,
      setItem: async (k: string, v: unknown) => {
        storage.set(k, v)
      },
      removeItem: async (k: string) => {
        storage.delete(k)
      },
    },
    _internal: { events },
  }
}
let config = makeConfig()
const account = {
  status: 'disconnected' as string,
  address: undefined as string | undefined,
  connector: undefined as FakeConnector | undefined,
  isConnected: false,
}

function connectEvm(connector: FakeConnector, address = '0xabc') {
  config.state.connections.set(connector.uid, {
    connector: { ...connector, emitter: { off() {} } },
  })
  config.state.current = connector.uid
  config.state.status = 'connected'
  account.status = 'connected'
  account.address = address
  account.connector = connector
  account.isConnected = true
}

const core = {
  connect: vi.fn(async () => ({})),
  disconnect: vi.fn(async () => {}),
  reconnect: vi.fn(async (): Promise<unknown[]> => []),
}
vi.mock('@wagmi/core', () => ({
  connect: (...args: unknown[]) => core.connect(...(args as [])),
  disconnect: (...args: unknown[]) => core.disconnect(...(args as [])),
  reconnect: (...args: unknown[]) => core.reconnect(...(args as [])),
}))
vi.mock('wagmi', () => ({
  useConfig: () => config,
  useConnectors: () => config.connectors,
  useAccount: () => account,
}))
vi.mock('../shared/hooks/useKitStore', () => ({
  useKitStore: () => store,
}))

// --- Solana stand-ins ------------------------------------------------------

const solanaAccount: WalletAccount = {
  address: '7S3P4HxJpyyigGzodYwHtCxZyUQe9JiBMHyRWXArAaKv',
  publicKey: new Uint8Array(32).fill(1),
  chains: ['solana:mainnet'],
  features: ['solana:signMessage'],
}

function solanaWallet(name: string) {
  const disconnect = vi.fn(async () => {})
  const connect = vi.fn(async () => ({ accounts: [solanaAccount] }))
  const wallet = {
    version: '1.0.0',
    name,
    icon: 'data:image/svg+xml;base64,',
    chains: ['solana:mainnet'],
    accounts: [solanaAccount],
    features: {
      'standard:connect': { version: '1.0.0', connect },
      'standard:disconnect': { version: '1.0.0', disconnect },
    },
  } as unknown as SolanaStandardWallet
  return { wallet, connect, disconnect }
}

beforeEach(() => {
  store = createStore()
  config = makeConfig()
  storage.clear()
  account.status = 'disconnected'
  account.address = undefined
  account.connector = undefined
  account.isConnected = false
  core.connect.mockClear()
  core.disconnect.mockClear()
  core.reconnect.mockClear()
  core.reconnect.mockResolvedValue([])
})

const render = () =>
  renderHook(() => useZeroDevWalletKit({ reconnectOnMount: false }))

describe('useZeroDevWalletKit', () => {
  it('reads both namespaces as disconnected by default', () => {
    const { result } = render()
    expect(result.current.eip155.isConnected).toBe(false)
    expect(result.current.solana.isConnected).toBe(false)
    expect(result.current.isConnected).toBe(false)
    expect(result.current.isReconnecting).toBe(false)
  })

  it('lists installed EVM wallets without the generic injected and kit connectors', () => {
    const { result } = render()
    expect(result.current.wallets.eip155.map((c) => c.id)).toEqual([
      'io.metamask',
      'io.rabby',
    ])
    expect(result.current.walletConnect).toEqual({
      eip155: false,
      solana: false,
    })
  })

  it('reflects the Solana slot, with the wallet identity', async () => {
    const { wallet } = solanaWallet('Phantom')
    const { result } = render()
    await act(async () => {
      await result.current.connect({ namespace: 'solana', wallet })
    })
    expect(result.current.solana.isConnected).toBe(true)
    expect(result.current.solana.address).toBe(solanaAccount.address)
    expect(result.current.solana.walletInfo?.name).toBe('Phantom')
    expect(result.current.isConnected).toBe(true)
    expect(result.current.eip155.isConnected).toBe(false)
  })

  it('reports a silent Solana restore as reconnecting', async () => {
    const { wallet, connect } = solanaWallet('Phantom')
    let release!: () => void
    connect.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ accounts: [solanaAccount] })
        }),
    )
    const { result } = render()
    let pending!: Promise<unknown>
    act(() => {
      pending = store.getState().solana.connect(wallet, { silent: true })
    })
    expect(result.current.solana.status).toBe('reconnecting')
    expect(result.current.solana.isReconnecting).toBe(true)
    expect(result.current.isReconnecting).toBe(true)
    await act(async () => {
      release()
      await pending
    })
    expect(result.current.solana.isReconnecting).toBe(false)
    expect(result.current.solana.isConnected).toBe(true)
  })

  it('reflects the wagmi connection as the EVM side', () => {
    connectEvm(metamask)
    const { result } = render()
    expect(result.current.eip155.isConnected).toBe(true)
    expect(result.current.eip155.address).toBe('0xabc')
    expect(result.current.eip155.walletInfo?.name).toBe('MetaMask')
  })

  describe('connect', () => {
    it('tries a silent EVM reconnect before prompting an installed wallet', async () => {
      storage.set('io.metamask.disconnected', true)
      core.reconnect.mockResolvedValueOnce([{ accounts: ['0xabc'] }])
      const { result } = render()
      await act(async () => {
        await result.current.connect({
          namespace: 'eip155',
          wallet: metamask as never,
        })
      })
      expect(storage.has('io.metamask.disconnected')).toBe(false)
      expect(core.reconnect).toHaveBeenCalledWith(config, {
        connectors: [metamask],
      })
      expect(core.connect).not.toHaveBeenCalled()
    })

    it('prompts the installed EVM wallet when the silent reconnect yields nothing', async () => {
      const { result } = render()
      await act(async () => {
        await result.current.connect({
          namespace: 'eip155',
          wallet: rabby as never,
        })
      })
      expect(core.connect).toHaveBeenCalledWith(config, { connector: rabby })
    })

    it('opens the sign-up flow through the kit connector by default', async () => {
      const { result } = render()
      await act(async () => {
        await result.current.connect()
      })
      expect(core.connect).toHaveBeenCalledWith(config, {
        connector: kitConnector,
      })
    })

    it('treats a dismissed sign-up as success when an EVM wallet connected inside it', async () => {
      core.connect.mockImplementationOnce(async () => {
        connectEvm(rabby)
        throw new AuthFlowDismissedError()
      })
      const { result } = render()
      await act(async () => {
        await expect(
          result.current.connect({ namespace: 'eip155' }),
        ).resolves.toBeUndefined()
      })
    })

    it('rejects a dismissed sign-up that connected nothing', async () => {
      core.connect.mockRejectedValueOnce(new AuthFlowDismissedError())
      const { result } = render()
      await act(async () => {
        await expect(result.current.connect()).rejects.toBeInstanceOf(
          AuthFlowDismissedError,
        )
      })
    })

    it('opens the sign-up flow for Solana and resolves once a Solana wallet connects', async () => {
      const { wallet } = solanaWallet('Phantom')
      const { result } = render()
      let pending!: Promise<void>
      act(() => {
        pending = result.current.connect({ namespace: 'solana' })
      })
      expect(store.getState().auth.step).toBe('sign-up')
      await act(async () => {
        await store.getState().solana.connect(wallet)
        store.getState().auth.goToStep(null)
        await pending
      })
      expect(result.current.solana.isConnected).toBe(true)
    })

    it('rejects the Solana sign-up when the flow closes without a connection', async () => {
      const { result } = render()
      let pending!: Promise<void>
      act(() => {
        pending = result.current.connect({ namespace: 'solana' })
      })
      await act(async () => {
        store.getState().auth.goToStep(null)
        await expect(pending).rejects.toBeInstanceOf(AuthFlowDismissedError)
      })
    })
  })

  describe('disconnect', () => {
    it('disconnects Solana alone, leaving wagmi untouched', async () => {
      const { wallet, disconnect } = solanaWallet('Phantom')
      connectEvm(rabby)
      const { result } = render()
      await act(async () => {
        await result.current.connect({ namespace: 'solana', wallet })
        await result.current.disconnect({ namespace: 'solana' })
      })
      expect(disconnect).toHaveBeenCalled()
      expect(result.current.solana.isConnected).toBe(false)
      expect(core.disconnect).not.toHaveBeenCalled()
      expect(config.state.connections.size).toBe(1)
    })

    it('disconnects the EVM side through wagmi when no wallet is shared', async () => {
      const { wallet } = solanaWallet('Phantom')
      connectEvm(rabby)
      const { result } = render()
      await act(async () => {
        await result.current.connect({ namespace: 'solana', wallet })
        await result.current.disconnect({ namespace: 'eip155' })
      })
      expect(core.disconnect).toHaveBeenCalledTimes(1)
      expect(core.disconnect.mock.calls[0]?.[1]).toMatchObject({
        connector: { uid: 'rb' },
      })
      expect(result.current.solana.isConnected).toBe(true)
    })

    it('detaches the EVM side at wagmi level when the wallet also serves Solana', async () => {
      const { wallet } = solanaWallet('MetaMask')
      connectEvm(metamask)
      const { result } = render()
      await act(async () => {
        await result.current.connect({ namespace: 'solana', wallet })
        await result.current.disconnect({ namespace: 'eip155' })
      })
      // No permission revoke: MetaMask would apply it to the whole site.
      expect(core.disconnect).not.toHaveBeenCalled()
      expect(config.state.connections.size).toBe(0)
      expect(config.state.status).toBe('disconnected')
      expect(storage.get('io.metamask.disconnected')).toBe(true)
      expect(result.current.solana.isConnected).toBe(true)
    })

    it('disconnects every EVM connection', async () => {
      connectEvm(rabby)
      connectEvm(metamask)
      const { result } = render()
      await act(async () => {
        await result.current.disconnect({ namespace: 'eip155' })
      })
      expect(core.disconnect).toHaveBeenCalledTimes(2)
    })

    it('disconnects both namespaces by default, without protecting either', async () => {
      const { wallet, disconnect } = solanaWallet('MetaMask')
      connectEvm(metamask)
      const { result } = render()
      await act(async () => {
        await result.current.connect({ namespace: 'solana', wallet })
        await result.current.disconnect()
      })
      expect(core.disconnect).toHaveBeenCalledTimes(1)
      expect(disconnect).toHaveBeenCalled()
      expect(result.current.solana.isConnected).toBe(false)
    })

    it('still clears Solana when the EVM disconnect fails, then rethrows', async () => {
      const { wallet } = solanaWallet('Phantom')
      connectEvm(rabby)
      core.disconnect.mockRejectedValueOnce(new Error('wallet unreachable'))
      const { result } = render()
      await act(async () => {
        await result.current.connect({ namespace: 'solana', wallet })
        await expect(result.current.disconnect()).rejects.toThrow(
          'wallet unreachable',
        )
      })
      expect(result.current.solana.isConnected).toBe(false)
    })
  })
})
