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

// The root vitest config aliases @zerodev/react-ui to source without the SVG
// plugin, so real icons render nothing there; stand in for them by name.
vi.mock('@zerodev/react-ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@zerodev/react-ui')>()
  const React = await import('react')
  return {
    ...actual,
    ListItemIcon: ({ name }: { name: string }) =>
      React.createElement('svg', { 'data-testid': `icon-${name}` }),
  }
})
vi.mock('../../hooks/useWalletConnectPairing', () => ({
  useWalletConnectPairing: () => ({
    uri: null,
    error: null,
    retry: () => {},
    deepLinkFor: () => null,
  }),
}))
vi.mock('../../../solana/hooks/useSolanaAutoReconnect', () => ({
  useSolanaAutoReconnect: () => {},
}))
vi.mock('../../hooks/useSolanaWalletConnectPairing', () => ({
  useSolanaWalletConnectPairing: () => ({
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
// The root renders the WalletSheets; probe their props instead of pulling
// radix + the pairing hook into these tests.
const sheetProps = vi.fn()
vi.mock('../../components/WalletSheet', () => ({
  WalletSheet: (props: { open: boolean }) => {
    sheetProps(props)
    return null
  },
}))
const evmSheet = () =>
  sheetProps.mock.calls
    .map((c) => c[0])
    .filter((p) => !p.hint)
    .at(-1)
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
  zdWalletConnect?: boolean
}
let connectors: FakeConnector[] = []
const fakeWagmiConfig = {
  get connectors() {
    return connectors
  },
  storage: {
    getItem: async () => null,
    setItem: async () => {},
    removeItem: async () => {},
  },
  state: { connections: new Map(), current: null, status: 'disconnected' },
  setState: () => {},
  subscribe: () => () => {},
  _internal: { events: { change() {}, disconnect() {}, connect() {} } },
}
/** wagmi's live EVM connections: the wallets already connected there. */
let connections: { connector: FakeConnector }[] = []
vi.mock('wagmi', () => ({
  useConnectors: () => connectors,
  useConnections: () => connections,
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
const walletConnect = (): FakeConnector => ({
  uid: 'wc',
  id: 'walletConnect',
  name: 'WalletConnect',
  type: 'walletConnect',
  zdWalletConnect: true,
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

const rowButton = (title: string) =>
  screen.getByText(title).closest('button') as HTMLButtonElement

beforeEach(() => {
  vi.clearAllMocks()
  window.localStorage.clear()
  store = createStore()
  connectors = []
  connections = []
  solanaWallets = []
})

describe('SignUp.Wallet with namespaces eip155 + solana', () => {
  it('asks which chain to connect when the wallet is installed on both sides', async () => {
    connectors = [announced('io.metamask', 'MetaMask')]
    const metamask = solanaWallet('MetaMask')
    solanaWallets = [metamask.wallet]
    render(
      <SignUp>
        <SignUp.Wallet walletId="metamask" namespaces={['eip155', 'solana']} />
      </SignUp>,
    )

    expect(screen.getByText('EVM')).toBeTruthy()
    expect(screen.getByText('SOLANA')).toBeTruthy()
    expect(screen.getByText('INSTALLED')).toBeTruthy()

    // The row tap opens the choice; nothing connects yet.
    fireEvent.click(screen.getByText('MetaMask'))
    expect(startWalletConnection).not.toHaveBeenCalled()
    expect(metamask.connect).not.toHaveBeenCalled()
    const choice = screen.getByTestId('chain-choice-MetaMask')
    expect(choice.querySelector('[data-testid="icon-ethereum"]')).toBeTruthy()
    expect(choice.querySelector('[data-testid="icon-solana"]')).toBeTruthy()

    // Solana connects through the Wallet Standard into the Solana slot.
    fireEvent.click(screen.getByText('Solana'))
    await waitFor(() => expect(goToStep).toHaveBeenCalledWith(null))
    expect(metamask.connect).toHaveBeenCalledTimes(1)
    expect(store.getState().solana.connection?.address).toBe(SOL_ADDRESS)
    expect(startWalletConnection).not.toHaveBeenCalled()
  })

  it('connects the Ethereum side when that chain is chosen', () => {
    connectors = [announced('io.metamask', 'MetaMask')]
    solanaWallets = [solanaWallet('MetaMask').wallet]
    render(
      <SignUp>
        <SignUp.Wallet walletId="metamask" namespaces={['eip155', 'solana']} />
      </SignUp>,
    )
    fireEvent.click(screen.getByText('MetaMask'))
    fireEvent.click(screen.getByText('Ethereum'))
    expect(startWalletConnection).toHaveBeenCalledTimes(1)
    expect(startWalletConnection.mock.calls[0]?.[0]).toMatchObject({
      connectorUid: connectors[0]?.uid,
      name: 'MetaMask',
    })
    expect(store.getState().solana.status).toBe('disconnected')
    expect(screen.queryByTestId('chain-choice-MetaMask')).toBeNull()
  })

  it('greys out a side that is already connected', async () => {
    connectors = [announced('io.metamask', 'MetaMask')]
    connections = [{ connector: connectors[0] as FakeConnector }]
    solanaWallets = [solanaWallet('MetaMask').wallet]
    render(
      <SignUp>
        <SignUp.Wallet walletId="metamask" namespaces={['eip155', 'solana']} />
      </SignUp>,
    )
    expect(screen.getByText('CONNECTED')).toBeTruthy()
    fireEvent.click(screen.getByText('MetaMask'))
    expect(rowButton('Ethereum').disabled).toBe(true)
    expect(rowButton('Solana').disabled).toBe(false)
  })

  it('connects Solana directly when only that side is installed, even with WalletConnect configured', async () => {
    connectors = [walletConnect()]
    const metamask = solanaWallet('MetaMask')
    solanaWallets = [metamask.wallet]
    render(
      <SignUp>
        <SignUp.Wallet walletId="metamask" namespaces={['eip155', 'solana']} />
      </SignUp>,
    )
    expect(screen.getByText('SOLANA')).toBeTruthy()
    expect(screen.queryByText('EVM')).toBeNull()

    fireEvent.click(screen.getByText('MetaMask'))
    await waitFor(() => expect(goToStep).toHaveBeenCalledWith(null))
    expect(metamask.connect).toHaveBeenCalledTimes(1)
    expect(startWalletConnection).not.toHaveBeenCalled()
    expect(evmSheet()?.open).toBe(false)
  })

  it('falls back to the EVM row when the wallet has no Solana registration', () => {
    connectors = [walletConnect()]
    solanaWallets = [solanaWallet('Phantom').wallet]
    render(
      <SignUp>
        <SignUp.Wallet walletId="metamask" namespaces={['eip155', 'solana']} />
      </SignUp>,
    )
    expect(screen.queryByText('SOLANA')).toBeNull()
    fireEvent.click(screen.getByText('MetaMask'))
    expect(evmSheet()?.open).toBe(true)
  })

  it('ignores the Solana registration without a solana namespace', () => {
    connectors = [announced('io.metamask', 'MetaMask')]
    solanaWallets = [solanaWallet('MetaMask').wallet]
    render(
      <SignUp>
        <SignUp.Wallet walletId="metamask" />
      </SignUp>,
    )
    expect(screen.queryByText('SOLANA')).toBeNull()
    fireEvent.click(screen.getByText('MetaMask'))
    expect(startWalletConnection).toHaveBeenCalledTimes(1)
  })

  it('keeps the pinned wallet out of the installed list on both sides', () => {
    connectors = [announced('io.metamask', 'MetaMask')]
    solanaWallets = [solanaWallet('MetaMask').wallet]
    render(
      <SignUp>
        <SignUp.Wallet walletId="metamask" namespaces={['eip155', 'solana']} />
        <SignUp.InstalledWallets namespaces={['eip155', 'solana']} />
      </SignUp>,
    )
    expect(screen.getAllByText('MetaMask').length).toBe(1)
  })
})
