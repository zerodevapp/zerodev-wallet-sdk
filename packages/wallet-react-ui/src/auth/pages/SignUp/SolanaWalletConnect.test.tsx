/**
 * @vitest-environment happy-dom
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { WalletSheetProps } from '../../components/WalletSheet'
import { SignUp } from './index'

afterEach(cleanup)

// The sheet is covered by its own test; here it is a probe for what the
// Solana unit hands it.
const sheet = vi.hoisted(() => ({ props: null as WalletSheetProps | null }))
vi.mock('../../components/WalletSheet', () => ({
  WalletSheet: (props: WalletSheetProps) => {
    sheet.props = props
    return null
  },
}))
vi.mock('../../hooks/useWalletConnectPairing', () => ({
  useWalletConnectPairing: () => ({
    uri: null,
    error: null,
    retry: () => {},
    deepLinkFor: () => null,
  }),
}))
vi.mock('../../hooks/useSolanaWalletConnectPairing', () => ({
  useSolanaWalletConnectPairing: () => ({
    uri: 'wc:solana@2?relay',
    error: null,
    retry: () => {},
    deepLinkFor: () => null,
  }),
}))
vi.mock('./Passkey', () => ({ SignUpPasskey: () => null }))
vi.mock('./Google', () => ({ SignUpGoogle: () => null }))
vi.mock('./Email', () => ({ SignUpEmail: () => null }))
vi.mock('./MoreWallets', () => ({ SignUpMoreWallets: () => null }))
vi.mock('../../components/BlobAnimation', () => ({ BlobAnimation: () => null }))
vi.mock('../../../shared/components/SignUpFooter', () => ({
  SignUpFooter: () => null,
}))
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ goToStep: vi.fn(), startWalletConnection: vi.fn() }),
}))
vi.mock('wagmi', () => ({ useConnectors: () => [], useConfig: () => ({}) }))

const walletConnect = vi.hoisted(() => ({ enabled: false }))
vi.mock('../../../solana/hooks/useSolanaWalletConnect', () => ({
  useSolanaWalletConnect: () => ({
    enabled: walletConnect.enabled,
    wallet: null,
    error: null,
    retry: () => {},
  }),
}))
vi.mock('../../../solana/hooks/useSolanaAutoReconnect', () => ({
  useSolanaAutoReconnect: () => {},
}))

describe('SignUp.SolanaWalletConnect', () => {
  it('renders nothing unless the connector enables Solana', () => {
    walletConnect.enabled = false
    render(
      <SignUp>
        <SignUp.SolanaWalletConnect />
      </SignUp>,
    )
    expect(screen.queryByText('WalletConnect')).toBeNull()
  })

  it('opens the Solana pairing sheet with its pairing', () => {
    walletConnect.enabled = true
    render(
      <SignUp>
        <SignUp.SolanaWalletConnect />
      </SignUp>,
    )
    expect(screen.getByText('SOLANA')).toBeTruthy()
    // The root's EVM sheet renders closed; the Solana one mounts on click.
    const last = () => sheet.props
    expect(last()?.open).toBe(false)
    fireEvent.click(screen.getByText('WalletConnect'))
    expect(last()?.open).toBe(true)
    expect(last()?.pairing.uri).toBe('wc:solana@2?relay')
    expect(last()?.hint).toMatch(/Phantom/)
  })
})
