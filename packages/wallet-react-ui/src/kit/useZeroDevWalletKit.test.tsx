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
// The WalletConnect door, as the auto-reconnect and the hook read it.
const walletConnectDoor = {
  enabled: false,
  wallet: null as SolanaStandardWallet | null,
  error: null as string | null,
  retry: () => {},
}
vi.mock('../solana/hooks/useSolanaWalletConnect', () => ({
  useSolanaWalletConnect: () => walletConnectDoor,
}))
const LAST_WALLET_KEY = 'zerodev:solana:lastWallet'

// --- Solana stand-ins ------------------------------------------------------

const solanaAccount: WalletAccount = {
  address: '7S3P4HxJpyyigGzodYwHtCxZyUQe9JiBMHyRWXArAaKv',
  publicKey: new Uint8Array(32).fill(1),
  chains: ['solana:mainnet'],
  features: ['solana:signMessage'],
}

function solanaWallet(name: string, source?: 'walletconnect') {
  const disconnect = vi.fn(async () => {})
  const connect = vi.fn(async () => ({ accounts: [solanaAccount] }))
  const wallet = {
    version: '1.0.0',
    name,
    ...(source && { source }),
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
  window.localStorage.clear()
  walletConnectDoor.enabled = false
  walletConnectDoor.wallet = null
  walletConnectDoor.error = null
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

  describe('restore after a reload', () => {
    const saveLast = (name: string, source: 'standard' | 'walletconnect') =>
      window.localStorage.setItem(
        LAST_WALLET_KEY,
        JSON.stringify({ name, source }),
      )
    const renderLive = () => {
      const seen: boolean[] = []
      const rendered = renderHook(() => {
        const kit = useZeroDevWalletKit()
        seen.push(kit.solana.isReconnecting)
        return kit
      })
      return { ...rendered, seen }
    }

    it('reports a saved installed wallet as reconnecting on the first render, and settles when it is absent', async () => {
      saveLast('Phantom', 'standard')
      const { result, seen } = renderLive()
      // First render: the restore has not run yet, so the host must wait.
      expect(seen[0]).toBe(true)
      await act(async () => {})
      // The registry has no Phantom (uninstalled): the restore settled empty.
      expect(result.current.solana.isReconnecting).toBe(false)
      expect(result.current.solana.status).toBe('disconnected')
      expect(result.current.solana.isConnected).toBe(false)
    })

    it('stays reconnecting while the WalletConnect provider loads, then restores through it', async () => {
      saveLast('Phantom', 'walletconnect')
      walletConnectDoor.enabled = true
      const { result, rerender } = renderLive()
      await act(async () => {})
      expect(result.current.solana.isReconnecting).toBe(true)
      expect(result.current.solana.status).toBe('reconnecting')
      expect(result.current.isReconnecting).toBe(true)

      const { wallet, connect } = solanaWallet('Phantom', 'walletconnect')
      walletConnectDoor.wallet = wallet
      await act(async () => {
        rerender()
      })
      expect(connect).toHaveBeenCalledWith({ silent: true })
      expect(result.current.solana.isConnected).toBe(true)
      expect(result.current.solana.isReconnecting).toBe(false)
    })

    it('settles when the WalletConnect provider fails to load', async () => {
      saveLast('Phantom', 'walletconnect')
      walletConnectDoor.enabled = true
      walletConnectDoor.error = 'import failed'
      const { result } = renderLive()
      await act(async () => {})
      expect(result.current.solana.isReconnecting).toBe(false)
    })

    it('settles when the saved WalletConnect door is no longer configured', async () => {
      saveLast('Phantom', 'walletconnect')
      const { result } = renderLive()
      await act(async () => {})
      expect(result.current.solana.isReconnecting).toBe(false)
    })

    it('settles when the silent connect is refused', async () => {
      saveLast('Phantom', 'walletconnect')
      walletConnectDoor.enabled = true
      const { wallet, connect } = solanaWallet('Phantom', 'walletconnect')
      connect.mockRejectedValueOnce(new Error('not authorised'))
      walletConnectDoor.wallet = wallet
      const { result } = renderLive()
      await act(async () => {})
      expect(result.current.solana.isReconnecting).toBe(false)
      expect(result.current.solana.isConnected).toBe(false)
    })

    it('never reports a pending restore with reconnectOnMount off', () => {
      saveLast('Phantom', 'standard')
      const { result } = render()
      expect(result.current.solana.isReconnecting).toBe(false)
    })
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

    it('reopens the Solana sign-up after an embedded login, with a clean history', async () => {
      // A passkey, Google or email login ends at the terminal `authenticated`
      // step and stays there; the Solana sign-up must open from it, and
      // must not leave `authenticated` behind as a back-arrow target.
      store.getState().auth.goToStep('sign-up')
      store.getState().auth.goToStep('authenticated')
      const { result } = render()
      let pending!: Promise<void>
      act(() => {
        pending = result.current.connect({ namespace: 'solana' })
      })
      expect(store.getState().auth.step).toBe('sign-up')
      expect(store.getState().auth.stepHistory).toEqual([])
      await act(async () => {
        store.getState().auth.goToStep(null)
        await expect(pending).rejects.toBeInstanceOf(AuthFlowDismissedError)
      })
    })

    it('ends a lingering authenticated step before the EVM sign-up too', async () => {
      store.getState().auth.goToStep('sign-up')
      store.getState().auth.goToStep('authenticated')
      const { result } = render()
      await act(async () => {
        await result.current.connect({ namespace: 'eip155' })
      })
      expect(store.getState().auth.step).toBeNull()
      expect(core.connect).toHaveBeenCalledWith(config, {
        connector: kitConnector,
      })
    })

    it('refuses to open the Solana sign-up over a flow that is still running', async () => {
      store.getState().auth.goToStep('sign-up')
      const { result } = render()
      await act(async () => {
        await expect(
          result.current.connect({ namespace: 'solana' }),
        ).rejects.toThrow('Auth flow already in progress')
      })
    })

    it('completes an embedded login picked during the Solana sign-up, then rejects as dismissed', async () => {
      const { result } = render()
      let pending!: Promise<void>
      act(() => {
        pending = result.current.connect({ namespace: 'solana' })
      })
      await act(async () => {
        // The passkey, Google and email units end the flow here, with the
        // session created but no wagmi connection yet.
        store.getState().auth.goToStep('authenticated')
        await expect(pending).rejects.toBeInstanceOf(AuthFlowDismissedError)
      })
      expect(core.connect).toHaveBeenCalledWith(config, {
        connector: kitConnector,
      })
    })

    it('still settles the Solana sign-up when completing the embedded login fails', async () => {
      core.connect.mockRejectedValueOnce(new Error('session gone'))
      const { result } = render()
      let pending!: Promise<void>
      act(() => {
        pending = result.current.connect({ namespace: 'solana' })
      })
      await act(async () => {
        store.getState().auth.goToStep('authenticated')
        await expect(pending).rejects.toBeInstanceOf(AuthFlowDismissedError)
      })
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
