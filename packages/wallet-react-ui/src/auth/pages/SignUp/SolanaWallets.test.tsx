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
// Sibling units pull in wagmi/wallet-react hooks — replace them with stubs so
// the tests exercise the SolanaWallets unit against the real root.
vi.mock('./Passkey', () => ({ SignUpPasskey: () => null }))
vi.mock('./Google', () => ({ SignUpGoogle: () => null }))
vi.mock('./Email', () => ({ SignUpEmail: () => null }))
vi.mock('./MoreWallets', () => ({ SignUpMoreWallets: () => null }))
const fakeWagmiConfig = {
  state: { connections: new Map(), current: null, status: 'disconnected' },
  setState: () => {},
  subscribe: () => () => {},
  _internal: { events: { change() {}, disconnect() {}, connect() {} } },
}
vi.mock('wagmi', () => ({
  useConnectors: () => [],
  useConfig: () => fakeWagmiConfig,
}))
vi.mock('../../components/BlobAnimation', () => ({
  BlobAnimation: () => null,
}))
vi.mock('../../components/WalletSheet', () => ({ WalletSheet: () => null }))
vi.mock('../../../shared/components/SignUpFooter', () => ({
  SignUpFooter: () => null,
}))

const goToStep = vi.fn()
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ goToStep }),
}))

// A real kit store, handed out by the kit-store hook in place of the wagmi
// connector lookup.
let store = createStore()
vi.mock('../../../shared/hooks/useKitStore', () => ({
  useKitStore: () => store,
}))

// Discovery is the registry's business; here the hook returns fixtures.
let wallets: SolanaStandardWallet[] = []
vi.mock('../../../solana/hooks/useSolanaWallets', () => ({
  useSolanaWallets: () => wallets,
}))

const SOL_ADDRESS = '7S3P4HxJpyyigGzodYwHtCxZyUQe9JiBMHyRWXArAaKv'

function fakeWallet(name: string, connect = vi.fn()) {
  connect.mockResolvedValue({
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
  wallets = []
})

describe('SignUp.SolanaWallets', () => {
  it('renders nothing when no Solana wallet is installed', () => {
    const { container } = render(
      <SignUp>
        <SignUp.SolanaWallets />
      </SignUp>,
    )
    expect(container.querySelectorAll('button').length).toBe(0)
  })

  it('lists each discovered wallet with a SOLANA badge, capped and filtered', () => {
    wallets = [
      fakeWallet('Phantom').wallet,
      fakeWallet('Solflare').wallet,
      fakeWallet('Backpack').wallet,
    ]
    render(
      <SignUp>
        <SignUp.SolanaWallets
          maxWallets={2}
          excludeWalletNames={['Solflare']}
        />
      </SignUp>,
    )
    expect(screen.getByText('Phantom')).toBeTruthy()
    expect(screen.getByText('Backpack')).toBeTruthy()
    expect(screen.queryByText('Solflare')).toBeNull()
    expect(screen.getAllByText('SOLANA').length).toBe(2)
    expect(screen.getAllByText('INSTALLED').length).toBe(2)
  })

  it('connects through the wallet, fills the Solana slot and closes the flow', async () => {
    const phantom = fakeWallet('Phantom')
    wallets = [phantom.wallet]
    render(
      <SignUp>
        <SignUp.SolanaWallets />
      </SignUp>,
    )

    fireEvent.click(screen.getByText('Phantom'))

    await waitFor(() => expect(goToStep).toHaveBeenCalledWith(null))
    expect(phantom.connect).toHaveBeenCalledTimes(1)
    expect(store.getState().solana.status).toBe('connected')
    expect(store.getState().solana.connection?.address).toBe(SOL_ADDRESS)
    expect(screen.getByText('CONNECTED')).toBeTruthy()
  })

  it('swallows a declined prompt and surfaces other failures', async () => {
    const declined = fakeWallet('Phantom')
    declined.connect.mockRejectedValue({ code: 4001 })
    const broken = fakeWallet('Solflare')
    broken.connect.mockRejectedValue(new Error('Wallet is locked'))
    wallets = [declined.wallet, broken.wallet]
    render(
      <SignUp>
        <SignUp.SolanaWallets />
      </SignUp>,
    )

    fireEvent.click(screen.getByText('Phantom'))
    await waitFor(() => expect(declined.connect).toHaveBeenCalledTimes(1))
    // The attempt has settled once the page-level pending lock is released,
    // which re-enables the rows. (The lock clears in a passive effect, one
    // tick after the CONNECTING badge disappears.)
    const rowButton = (name: string) =>
      screen.getByText(name).closest('button') as HTMLButtonElement
    await waitFor(() => expect(rowButton('Solflare').disabled).toBe(false), {
      timeout: 3000,
    })
    expect(goToStep).not.toHaveBeenCalled()
    expect(screen.queryByText('Error occurred')).toBeNull()

    fireEvent.click(screen.getByText('Solflare'))
    await waitFor(
      () => expect(screen.getByText('Error occurred')).toBeTruthy(),
      {
        timeout: 3000,
      },
    )
    expect(screen.getByText('Wallet is locked')).toBeTruthy()
    expect(store.getState().solana.status).toBe('disconnected')
  })

  it('leaves the EVM-side units alone: the wagmi connection is untouched', async () => {
    const phantom = fakeWallet('Phantom')
    wallets = [phantom.wallet]
    render(
      <SignUp>
        <SignUp.SolanaWallets />
      </SignUp>,
    )
    fireEvent.click(screen.getByText('Phantom'))
    await waitFor(() => expect(goToStep).toHaveBeenCalledWith(null))
    // Nothing in the auth slice moved: no pending wagmi wallet, no step push.
    expect(store.getState().auth.pendingWallet).toBeNull()
    expect(store.getState().auth.step).toBeNull()
  })
})
