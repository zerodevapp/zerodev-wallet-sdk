/**
 * @vitest-environment happy-dom
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

// Not a mobile device unless a test overrides it — keeps the auto-deeplink
// effect quiet.
const mobile = vi.hoisted(() => ({ value: false }))
vi.mock('../../utils/isMobile', () => ({
  isMobile: () => mobile.value,
}))

const connect = vi.fn()
let connectors: unknown[] = []
vi.mock('wagmi', () => ({
  useConnectors: () => connectors,
  useConnect: () => ({ mutate: connect }),
  useConnections: () => [],
}))

type MessageHandler = (event: { type: string; data?: unknown }) => void

function fakeWcConnector() {
  const handlers = new Set<MessageHandler>()
  return {
    uid: crypto.randomUUID(),
    id: 'walletConnect',
    type: 'walletConnect',
    zdWalletConnect: true,
    emitter: {
      on: (_event: string, handler: MessageHandler) => {
        handlers.add(handler)
      },
      off: (_event: string, handler: MessageHandler) => {
        handlers.delete(handler)
      },
    },
    emit: (event: { type: string; data?: unknown }) => {
      for (const handler of handlers) handler(event)
    },
  }
}

const metamask = WALLET_GUIDE.find((w) => w.id === 'metamask')
if (!metamask) throw new Error('metamask missing from WALLET_GUIDE')

beforeEach(() => {
  vi.clearAllMocks()
  connectors = []
})

describe('WalletSheet', () => {
  it('starts a fresh pairing per open and none while closed', () => {
    const wc = fakeWcConnector()
    connectors = [wc]
    const { rerender } = render(
      <WalletSheet open={false} onOpenChange={() => {}} />,
    )
    expect(connect).not.toHaveBeenCalled()

    rerender(<WalletSheet open onOpenChange={() => {}} />)
    expect(connect).toHaveBeenCalledTimes(1)

    rerender(<WalletSheet open={false} onOpenChange={() => {}} />)
    rerender(<WalletSheet open onOpenChange={() => {}} />)
    expect(connect).toHaveBeenCalledTimes(2)
  })

  it('generic mode: no tabs, raw-URI QR once the link arrives', () => {
    const wc = fakeWcConnector()
    connectors = [wc]
    render(<WalletSheet open onOpenChange={() => {}} />)
    expect(screen.getByText('Generating connection link…')).toBeDefined()
    expect(screen.queryByText('Mobile')).toBeNull()

    act(() => wc.emit({ type: 'display_uri', data: 'wc:raw@2' }))
    expect(screen.getByTestId('qr').getAttribute('data-value')).toBe('wc:raw@2')
  })

  it('per-wallet mobile tab wraps the URI in the wallet deep link', () => {
    const wc = fakeWcConnector()
    connectors = [wc]
    render(<WalletSheet open onOpenChange={() => {}} wallet={metamask} />)
    // Not installed → Mobile preselected.
    act(() => wc.emit({ type: 'display_uri', data: 'wc:abc@2' }))
    expect(screen.getByTestId('qr').getAttribute('data-value')).toBe(
      `${metamask.mobileLink}${encodeURIComponent('wc:abc@2')}`,
    )
    expect(screen.getByText(`Open in ${metamask.name}`)).toBeDefined()
  })

  it('defaults to the Browser tab when a connector claims the wallet', () => {
    const wc = fakeWcConnector()
    const announced = { id: 'io.metamask', uid: crypto.randomUUID() }
    connectors = [wc, announced]
    render(<WalletSheet open onOpenChange={() => {}} wallet={metamask} />)

    const button = screen.getByText(`Open in ${metamask.name}`)
    fireEvent.click(button)
    expect(connect.mock.calls.at(-1)?.[0]).toEqual({ connector: announced })
    act(() => connect.mock.calls.at(-1)?.[1].onSuccess())
    expect(goToStep).toHaveBeenCalledWith(null)
  })

  it('Browser tab links to the download page when nothing claims the wallet', () => {
    const wc = fakeWcConnector()
    connectors = [wc]
    render(<WalletSheet open onOpenChange={() => {}} wallet={metamask} />)
    fireEvent.click(screen.getByText('Browser'))
    const link = screen.getByText(`Get ${metamask.name}`)
    expect(link.getAttribute('href')).toBe(metamask.downloadUrl)
  })

  it('shows pairing errors with a retry that reconnects', () => {
    const wc = fakeWcConnector()
    connectors = [wc]
    render(<WalletSheet open onOpenChange={() => {}} />)
    act(() => connect.mock.calls[0][1].onError(new Error('relay down')))
    expect(screen.getByText('relay down')).toBeDefined()

    fireEvent.click(screen.getByText('Try again'))
    expect(connect).toHaveBeenCalledTimes(2)
  })

  it('copies the raw URI', async () => {
    const writeText = vi
      .spyOn(navigator.clipboard, 'writeText')
      .mockResolvedValue(undefined)
    const wc = fakeWcConnector()
    connectors = [wc]
    render(<WalletSheet open onOpenChange={() => {}} />)
    act(() => wc.emit({ type: 'display_uri', data: 'wc:copy@2' }))

    await act(async () => {
      fireEvent.click(screen.getByText('Copy link'))
    })
    expect(writeText).toHaveBeenCalledWith('wc:copy@2')
    expect(screen.getByText('Copied')).toBeDefined()
  })
})
