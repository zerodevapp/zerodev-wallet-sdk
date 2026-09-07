/**
 * @vitest-environment happy-dom
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WalletConnectPairing } from '../../hooks/useWalletConnectPairing'
import { WALLET_GUIDE } from '../../walletGuide'
import { WalletSheet } from './index'

afterEach(cleanup)

// The sheet chrome is radix Dialog portaling into the Screen overlay — swap
// it for a plain conditional wrapper so the body renders without a Screen.
// QrCode becomes a probe exposing the encoded value.
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

const goToStep = vi.fn()
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ goToStep }),
}))

const connect = vi.fn()
let connectors: unknown[] = []
vi.mock('wagmi', () => ({
  useConnectors: () => connectors,
  useConnect: () => ({ connect }),
}))

/** Prop double for the page-level pairing the SignUp root provides. */
function fakePairing(
  over: Partial<WalletConnectPairing> = {},
): WalletConnectPairing {
  return {
    uri: null,
    error: null,
    retry: vi.fn(),
    deepLinkFor: () => null,
    ...over,
  }
}

const metamask = WALLET_GUIDE.find((w) => w.id === 'metamask')
if (!metamask) throw new Error('metamask missing from WALLET_GUIDE')

beforeEach(() => {
  vi.clearAllMocks()
  connectors = []
})

describe('WalletSheet', () => {
  it('generic mode: no tabs, spinner until the URI lands, then a raw-URI QR', () => {
    const { rerender } = render(
      <WalletSheet open onOpenChange={() => {}} pairing={fakePairing()} />,
    )
    expect(screen.queryByText('Mobile')).toBeNull()
    // Pending state: no QR yet, copy stays disabled until the URI arrives.
    expect(screen.queryByTestId('qr')).toBeNull()
    expect(screen.getByText('Copy link').closest('button')?.disabled).toBe(true)

    rerender(
      <WalletSheet
        open
        onOpenChange={() => {}}
        pairing={fakePairing({ uri: 'wc:raw@2' })}
      />,
    )
    expect(screen.getByTestId('qr').getAttribute('data-value')).toBe('wc:raw@2')
  })

  it('per-wallet mobile tab wraps the URI in the wallet deep link', () => {
    render(
      <WalletSheet
        open
        onOpenChange={() => {}}
        wallet={metamask}
        pairing={fakePairing({ uri: 'wc:abc@2' })}
      />,
    )
    // Not installed → Mobile preselected.
    expect(screen.getByTestId('qr').getAttribute('data-value')).toBe(
      `${metamask.mobileLink}${encodeURIComponent('wc:abc@2')}`,
    )
    expect(screen.getByText(`Open in ${metamask.name}`)).toBeDefined()
  })

  it('defaults to the Browser tab when a connector claims the wallet', () => {
    const announced = { id: 'io.metamask', uid: crypto.randomUUID() }
    connectors = [announced]
    render(
      <WalletSheet
        open
        onOpenChange={() => {}}
        wallet={metamask}
        pairing={fakePairing()}
      />,
    )

    const button = screen.getByText(`Open in ${metamask.name}`)
    fireEvent.click(button)
    expect(connect.mock.calls.at(-1)?.[0]).toEqual({ connector: announced })
    act(() => connect.mock.calls.at(-1)?.[1].onSuccess())
    expect(goToStep).toHaveBeenCalledWith(null)
  })

  it('Browser tab links to the download page when nothing claims the wallet', () => {
    render(
      <WalletSheet
        open
        onOpenChange={() => {}}
        wallet={metamask}
        pairing={fakePairing()}
      />,
    )
    fireEvent.click(screen.getByText('Browser'))
    const link = screen.getByText(`Get ${metamask.name}`)
    expect(link.getAttribute('href')).toBe(metamask.downloadUrl)
  })

  it('shows pairing errors with a retry', () => {
    const pairing = fakePairing({ error: 'relay down' })
    render(<WalletSheet open onOpenChange={() => {}} pairing={pairing} />)
    expect(screen.getByText('relay down')).toBeDefined()

    fireEvent.click(screen.getByText('Try again'))
    expect(pairing.retry).toHaveBeenCalledTimes(1)
  })

  it('copies the raw URI', async () => {
    const writeText = vi
      .spyOn(navigator.clipboard, 'writeText')
      .mockResolvedValue(undefined)
    render(
      <WalletSheet
        open
        onOpenChange={() => {}}
        pairing={fakePairing({ uri: 'wc:copy@2' })}
      />,
    )

    await act(async () => {
      fireEvent.click(screen.getByText('Copy link'))
    })
    expect(writeText).toHaveBeenCalledWith('wc:copy@2')
    expect(screen.getByText('Copied')).toBeDefined()
  })
})
