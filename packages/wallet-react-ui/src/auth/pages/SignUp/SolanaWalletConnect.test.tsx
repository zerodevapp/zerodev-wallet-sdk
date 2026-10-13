/**
 * @vitest-environment happy-dom
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SignUp } from './index'

afterEach(cleanup)

// The bottom sheet portals and animates; render it inline for the assertion.
vi.mock('@zerodev/react-ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@zerodev/react-ui')>()
  return {
    ...actual,
    BottomSheet: ({
      open,
      children,
    }: {
      open: boolean
      children: ReactNode
    }) => (open ? <div data-testid="wallet-sheet">{children}</div> : null),
    BottomSheetContent: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
    BottomSheetTitle: () => null,
    BottomSheetClose: ({ children }: { children: ReactNode }) => children,
    QrCode: ({ value }: { value: string }) => (
      <div data-testid="qr" data-value={value} />
    ),
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

  it('opens the Solana pairing sheet with its QR', () => {
    walletConnect.enabled = true
    render(
      <SignUp>
        <SignUp.SolanaWalletConnect />
      </SignUp>,
    )
    expect(screen.getByText('SOLANA')).toBeTruthy()
    fireEvent.click(screen.getByText('WalletConnect'))
    // The sheet mounts the pairing hook; its QR carries the pairing URI.
    expect(screen.getByTestId('qr').getAttribute('data-value')).toBe(
      'wc:solana@2?relay',
    )
  })
})
