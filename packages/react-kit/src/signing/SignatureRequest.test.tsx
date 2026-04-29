import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createStore } from '../store'
import type { PendingRequest } from '../types'

// Must be a stable reference (like real wagmi) so the effect doesn't re-run on every render.
const mockStore = createStore()
const mockConfig = {
  connectors: [
    {
      id: 'zerodev-wallet',
      getKitStore: () => mockStore,
    },
  ],
}

vi.mock('wagmi', () => ({
  useConfig: () => mockConfig,
}))

import { SignatureRequest, type SignatureRequestProps } from './index'

function createMockPendingRequest(
  overrides?: Partial<PendingRequest>,
): PendingRequest {
  return {
    id: crypto.randomUUID(),
    method: 'eth_sendTransaction',
    params: [{ to: '0x1234', value: '0x0' }],
    resolve: vi.fn(),
    reject: vi.fn(),
    ...overrides,
  } as PendingRequest
}

const mockSignatureRequestProps: SignatureRequestProps = {
  dapp: {
    name: 'Mock DApp',
    domain: 'mock.test',
    network: 'ethereum',
    imageSource: 'https://example.com/dapp.png',
  },
  selectedGasTier: 'market',
  gasFees: [
    { tier: 'low', duration: 60, fee: '0.0001 ETH', feeUsd: '$0.10' },
    { tier: 'market', duration: 30, fee: '0.0002 ETH', feeUsd: '$0.20' },
    { tier: 'fast', duration: 15, fee: '0.0004 ETH', feeUsd: '$0.40' },
  ],
  slippage: 0.5,
  tokenSubtitle: '$100.00 USD',
  tokenImageSource: 'https://example.com/token.png',
  recipientImageSource: 'https://example.com/recipient.png',
  spenderImageSource: 'https://example.com/spender.png',
}

afterEach(() => {
  cleanup()
  mockStore.getState().clearPendingRequests()
  mockStore.getState().setUserConfirmationListenerActive(false)
})

describe('SignatureRequest', () => {
  it('renders nothing when no pending request', () => {
    const { container } = render(
      <SignatureRequest {...mockSignatureRequestProps} />,
    )
    expect(container.innerHTML).toBe('')
  })

  it('registers on mount', () => {
    render(<SignatureRequest {...mockSignatureRequestProps} />)
    expect(mockStore.getState().userConfirmationListenerActive).toBe(true)
  })

  it('deregisters on unmount', () => {
    const { unmount } = render(
      <SignatureRequest {...mockSignatureRequestProps} />,
    )
    expect(mockStore.getState().userConfirmationListenerActive).toBe(true)

    unmount()
    expect(mockStore.getState().userConfirmationListenerActive).toBe(false)
  })

  it('renders when pending request exists', () => {
    const request = createMockPendingRequest()
    mockStore.getState().addPendingRequest(request)

    render(<SignatureRequest {...mockSignatureRequestProps} />)

    expect(screen.getByText('Confirm Request')).toBeDefined()
    expect(screen.getByText('eth_sendTransaction')).toBeDefined()
    expect(screen.getByText('Confirm')).toBeDefined()
    expect(screen.getByText('Reject')).toBeDefined()
  })

  it('displays request params', () => {
    const request = createMockPendingRequest()
    mockStore.getState().addPendingRequest(request)

    render(<SignatureRequest {...mockSignatureRequestProps} />)

    const pre = screen.getByText(/0x1234/)
    expect(pre).toBeDefined()
  })

  it('calls resolve and clears on confirm click', () => {
    const request = createMockPendingRequest()
    mockStore.getState().addPendingRequest(request)

    render(<SignatureRequest {...mockSignatureRequestProps} />)
    fireEvent.click(screen.getByText('Confirm'))

    expect(request.resolve).toHaveBeenCalled()
    expect(mockStore.getState().pendingRequests).toEqual([])
  })

  it('calls reject and clears on reject click', () => {
    const request = createMockPendingRequest()
    mockStore.getState().addPendingRequest(request)

    render(<SignatureRequest {...mockSignatureRequestProps} />)
    fireEvent.click(screen.getByText('Reject'))

    expect(request.reject).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'User rejected the request' }),
    )
    expect(mockStore.getState().pendingRequests).toEqual([])
  })

  it('does not show pending count with a single request', () => {
    const request = createMockPendingRequest()
    mockStore.getState().addPendingRequest(request)

    render(<SignatureRequest {...mockSignatureRequestProps} />)

    expect(screen.queryByText(/more pending/)).toBeNull()
  })

  it('shows singular pending text for one extra request', () => {
    mockStore.getState().addPendingRequest(createMockPendingRequest())
    mockStore.getState().addPendingRequest(createMockPendingRequest())

    render(<SignatureRequest {...mockSignatureRequestProps} />)

    expect(screen.getByText('+1 more pending request')).toBeDefined()
  })

  it('shows pending count when multiple requests are queued', () => {
    mockStore.getState().addPendingRequest(createMockPendingRequest())
    mockStore.getState().addPendingRequest(createMockPendingRequest())
    mockStore.getState().addPendingRequest(createMockPendingRequest())

    render(<SignatureRequest {...mockSignatureRequestProps} />)

    expect(screen.getByText('+2 more pending requests')).toBeDefined()
  })

  it('rejects dangling requests on unmount', () => {
    const request = createMockPendingRequest()
    mockStore.getState().addPendingRequest(request)

    const { unmount } = render(
      <SignatureRequest {...mockSignatureRequestProps} />,
    )
    unmount()

    expect(request.reject).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Confirmation listener unmounted' }),
    )
    expect(mockStore.getState().pendingRequests).toEqual([])
  })
})
