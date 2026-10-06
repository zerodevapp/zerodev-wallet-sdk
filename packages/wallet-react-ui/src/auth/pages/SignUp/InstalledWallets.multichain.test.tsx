/**
 * @vitest-environment happy-dom
 */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SolanaStandardWallet } from '../../../solana/types'
import { createStore } from '../../../store'
import { SignUp } from './index'

afterEach(cleanup)

// The SignUp root preloads the page-level pairing — inert here.
vi.mock('../../hooks/useWalletConnectPairing', () => ({
  useWalletConnectPairing: () => ({
    uri: null,
    error: null,
    retry: () => {},
    deepLinkFor: () => null,
  }),
}))
vi.mock('./Passkey', () => ({ SignUpPasskey: () => null }))
vi.mock('./Google', () => ({ SignUpGoogle: () => null }))
vi.mock('./Email', () => ({ SignUpEmail: () => null }))
vi.mock('./MoreWallets', () => ({ SignUpMoreWallets: () => null }))
vi.mock('../../components/BlobAnimation', () => ({
  BlobAnimation: () => null,
}))
vi.mock('../../components/WalletSheet', () => ({ WalletSheet: () => null }))
vi.mock('../../../shared/components/SignUpFooter', () => ({
  SignUpFooter: () => null,
}))

const goToStep = vi.fn()
const startWalletConnection = vi.fn()
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ goToStep, startWalletConnection }),
}))

let store = createStore()
vi.mock('../../../shared/hooks/useKitStore', () => ({
  useKitStore: () => store,
}))

type FakeConnector = {
  uid: string
  id: string
  name: string
  type: string
  icon?: string
}
let connectors: FakeConnector[] = []
const fakeWagmiConfig = {
  state: { connections: new Map(), current: null, status: 'disconnected' },
  setState: () => {},
  subscribe: () => () => {},
  _internal: { events: { change() {}, disconnect() {}, connect() {} } },
}
vi.mock('wagmi', () => ({
  useConnectors: () => connectors,
  useConfig: () => fakeWagmiConfig,
}))

let solanaWallets: SolanaStandardWallet[] = []
vi.mock('../../../solana/hooks/useSolanaWallets', () => ({
  useSolanaWallets: () => solanaWallets,
}))

const announced = (id: string, name: string): FakeConnector => ({
  uid: crypto.randomUUID(),
  id,
  name,
  type: 'injected',
  icon: 'data:image/svg+xml,announced',
})

const SOL_ADDRESS = '7S3P4HxJpyyigGzodYwHtCxZyUQe9JiBMHyRWXArAaKv'

function solanaWallet(name: string) {
  const connect = vi.fn().mockResolvedValue({
    accounts: [
      {
        address: SOL_ADDRESS,
        publicKey: new Uint8Array(32),
        chains: ['solana:mainnet'],
        features: [],
      },
    ],
  })
  return {
    wallet: {
      version: '1.0.0',
      name,
      icon: 'data:image/svg+xml;base64,',
      chains: ['solana:mainnet'],
      accounts: [],
      features: { 'standard:connect': { version: '1.0.0', connect } },
    } as unknown as SolanaStandardWallet,
    connect,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  window.localStorage.clear()
  store = createStore()
  connectors = []
  solanaWallets = []
})

describe('SignUp.InstalledWallets with namespaces eip155 + solana', () => {
  it('merges a wallet announced on both sides into one row with a chain choice', async () => {
    connectors = [announced('app.phantom', 'Phantom')]
    const phantom = solanaWallet('Phantom')
    solanaWallets = [phantom.wallet]
    render(
      <SignUp>
        <SignUp.InstalledWallets namespaces={['eip155', 'solana']} />
      </SignUp>,
    )

    // One Phantom row, badged for both namespaces.
    expect(screen.getAllByText('Phantom').length).toBe(1)
    expect(screen.getByText('EVM')).toBeTruthy()
    expect(screen.getByText('SOLANA')).toBeTruthy()

    // Clicking it does not connect anything yet: it opens the chain choice.
    fireEvent.click(screen.getByText('Phantom'))
    expect(startWalletConnection).not.toHaveBeenCalled()
    expect(phantom.connect).not.toHaveBeenCalled()
    const choice = screen.getByTestId('chain-choice-Phantom')
    expect(choice).toBeTruthy()
    // Each chain row carries its chain icon in the leading tile (the
    // trailing chevron sits outside that tile, so it is not counted).
    expect(
      choice.querySelectorAll('button > div > div:first-child > svg').length,
    ).toBe(2)

    // Solana connects through the Wallet Standard and fills the Solana slot.
    fireEvent.click(screen.getByText('Solana'))
    await waitFor(() => expect(goToStep).toHaveBeenCalledWith(null))
    expect(phantom.connect).toHaveBeenCalledTimes(1)
    expect(store.getState().solana.connection?.address).toBe(SOL_ADDRESS)
    expect(startWalletConnection).not.toHaveBeenCalled()
  })

  it('connects the Ethereum side when that chain is chosen', () => {
    connectors = [announced('app.phantom', 'Phantom')]
    solanaWallets = [solanaWallet('Phantom').wallet]
    render(
      <SignUp>
        <SignUp.InstalledWallets namespaces={['eip155', 'solana']} />
      </SignUp>,
    )
    fireEvent.click(screen.getByText('Phantom'))
    fireEvent.click(screen.getByText('Ethereum'))
    expect(startWalletConnection).toHaveBeenCalledTimes(1)
    expect(startWalletConnection.mock.calls[0]?.[0]).toMatchObject({
      connectorUid: connectors[0]?.uid,
      name: 'Phantom',
    })
    expect(store.getState().solana.status).toBe('disconnected')
  })

  it('connects single-namespace wallets directly', async () => {
    connectors = [announced('io.metamask', 'MetaMask')]
    const solflare = solanaWallet('Solflare')
    solanaWallets = [solflare.wallet]
    render(
      <SignUp>
        <SignUp.InstalledWallets namespaces={['eip155', 'solana']} />
      </SignUp>,
    )

    fireEvent.click(screen.getByText('MetaMask'))
    expect(startWalletConnection).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Ethereum')).toBeNull()

    fireEvent.click(screen.getByText('Solflare'))
    await waitFor(() => expect(goToStep).toHaveBeenCalledWith(null))
    expect(solflare.connect).toHaveBeenCalledTimes(1)
  })

  it('lists only Solana wallets when eip155 is left out', () => {
    connectors = [announced('io.metamask', 'MetaMask')]
    solanaWallets = [solanaWallet('Phantom').wallet]
    render(
      <SignUp>
        <SignUp.InstalledWallets namespaces={['solana']} />
      </SignUp>,
    )
    expect(screen.queryByText('MetaMask')).toBeNull()
    expect(screen.getByText('Phantom')).toBeTruthy()
    expect(screen.queryByText('EVM')).toBeNull()
  })

  it('honours excludeWalletIds by Solana wallet name and the row cap', () => {
    connectors = [announced('io.metamask', 'MetaMask')]
    solanaWallets = [
      solanaWallet('Phantom').wallet,
      solanaWallet('Solflare').wallet,
    ]
    render(
      <SignUp>
        <SignUp.InstalledWallets
          namespaces={['eip155', 'solana']}
          excludeWalletIds={['phantom']}
          maxWallets={1}
        />
      </SignUp>,
    )
    expect(screen.queryByText('Phantom')).toBeNull()
    // Guide wallets rank first, so the cap keeps MetaMask.
    expect(screen.getByText('MetaMask')).toBeTruthy()
    expect(screen.queryByText('Solflare')).toBeNull()
  })

  it('keeps the EVM-only behaviour by default', () => {
    connectors = [announced('app.phantom', 'Phantom')]
    solanaWallets = [solanaWallet('Phantom').wallet]
    render(
      <SignUp>
        <SignUp.InstalledWallets />
      </SignUp>,
    )
    expect(screen.queryByText('SOLANA')).toBeNull()
    fireEvent.click(screen.getByText('Phantom'))
    expect(startWalletConnection).toHaveBeenCalledTimes(1)
  })
})
