import { beforeEach, describe, expect, it, vi } from 'vitest'
import { zeroDevWalletConnect } from './zeroDevWalletConnect'

type FakeProvider = {
  session?: unknown
  on: ReturnType<typeof vi.fn>
  emit: (event: string) => void
}

/** Provider double with a working on/emit pair and an optional session. */
function fakeProvider(session?: unknown): FakeProvider {
  const handlers: Record<string, Array<() => void>> = {}
  return {
    session,
    on: vi.fn((event: string, cb: () => void) => {
      ;(handlers[event] ??= []).push(cb)
    }),
    emit: (event: string) => {
      for (const cb of handlers[event] ?? []) cb()
    },
  }
}

const { walletConnect, providerBox } = vi.hoisted(() => {
  const providerBox = { value: undefined as unknown }
  return {
    providerBox,
    walletConnect: vi.fn(() => () => ({
      id: 'walletConnect',
      getProvider: async () => providerBox.value,
    })),
  }
})
vi.mock('wagmi/connectors', () => ({ walletConnect }))

const mobile = vi.hoisted(() => ({ value: true }))
vi.mock('./auth/utils/isMobile', () => ({
  isMobile: () => mobile.value,
}))

const KEY = 'WALLETCONNECT_DEEPLINK_CHOICE'
const metamaskSession = {
  peer: {
    metadata: { name: 'MetaMask', redirect: { native: 'metamask://' } },
  },
}

/** Create a connector through the factory and hand back its provider. */
async function connectorProvider(provider: FakeProvider) {
  providerBox.value = provider
  const connector = zeroDevWalletConnect({ projectId: 'pid' })({} as never)
  await connector.getProvider()
  return provider
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  mobile.value = true
  providerBox.value = undefined
})

describe('zeroDevWalletConnect', () => {
  it('bakes showQrModal: false into the wagmi connector', () => {
    zeroDevWalletConnect({ projectId: 'pid' })
    expect(walletConnect).toHaveBeenCalledWith({
      projectId: 'pid',
      showQrModal: false,
    })
  })

  it('forwards extra WalletConnect parameters', () => {
    const metadata = {
      name: 'My App',
      description: '',
      url: 'https://my.app',
      icons: [],
    }
    zeroDevWalletConnect({ projectId: 'pid', metadata })
    expect(walletConnect).toHaveBeenCalledWith({
      projectId: 'pid',
      metadata,
      showQrModal: false,
    })
  })

  it('stamps the connector instance for the kit discovery', () => {
    const create = zeroDevWalletConnect({ projectId: 'pid' })
    const connector = create({} as never)
    expect(connector).toMatchObject({
      id: 'walletConnect',
      zdWalletConnect: true,
    })
  })

  it('throws early without a projectId', () => {
    expect(() => zeroDevWalletConnect({ projectId: '' })).toThrow(/projectId/)
    expect(walletConnect).not.toHaveBeenCalled()
  })

  it('stores the wallet deep-link choice when the session connects on mobile', async () => {
    const provider = await connectorProvider(fakeProvider())
    provider.session = metamaskSession
    provider.emit('connect')

    expect(JSON.parse(localStorage.getItem(KEY) ?? 'null')).toEqual({
      href: 'metamask://',
      name: 'MetaMask',
    })
  })

  it('stays unarmed on desktop sessions', async () => {
    mobile.value = false
    const provider = await connectorProvider(fakeProvider())
    provider.session = metamaskSession
    provider.emit('connect')

    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('stays unarmed when the wallet registers no native redirect', async () => {
    const provider = await connectorProvider(fakeProvider())
    provider.session = { peer: { metadata: { name: 'NoRedirect' } } }
    provider.emit('connect')

    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('clears the choice on disconnect', async () => {
    const provider = await connectorProvider(fakeProvider())
    provider.session = metamaskSession
    provider.emit('connect')
    expect(localStorage.getItem(KEY)).not.toBeNull()

    provider.emit('disconnect')
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('re-arms a session restored from storage without an event', async () => {
    await connectorProvider(fakeProvider(metamaskSession))
    expect(JSON.parse(localStorage.getItem(KEY) ?? 'null')).toEqual({
      href: 'metamask://',
      name: 'MetaMask',
    })
  })

  it('subscribes once across repeated getProvider calls', async () => {
    const provider = fakeProvider()
    providerBox.value = provider
    const connector = zeroDevWalletConnect({ projectId: 'pid' })({} as never)
    await connector.getProvider()
    await connector.getProvider()

    const events = provider.on.mock.calls.map((c) => c[0])
    expect(events).toEqual(['connect', 'disconnect'])
  })
})
