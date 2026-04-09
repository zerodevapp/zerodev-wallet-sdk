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

import { SignatureRequest } from './SignatureRequest'

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

afterEach(() => {
  cleanup()
  mockStore.getState().clearPendingRequests()
  mockStore.getState().setUserConfirmationListenerActive(false)
})

describe('SignatureRequest', () => {
  it('renders nothing when no pending request', () => {
    const { container } = render(<SignatureRequest />)
    expect(container.innerHTML).toBe('')
  })

  it('registers on mount', () => {
    render(<SignatureRequest />)
    expect(mockStore.getState().userConfirmationListenerActive).toBe(true)
  })

  it('deregisters on unmount', () => {
    const { unmount } = render(<SignatureRequest />)
    expect(mockStore.getState().userConfirmationListenerActive).toBe(true)

    unmount()
    expect(mockStore.getState().userConfirmationListenerActive).toBe(false)
  })

  it('renders when pending request exists', () => {
    const request = createMockPendingRequest()
    mockStore.getState().addPendingRequest(request)

    render(<SignatureRequest />)

    expect(screen.getByText('Confirm Request')).toBeDefined()
    expect(screen.getByText('eth_sendTransaction')).toBeDefined()
    expect(screen.getByText('Confirm')).toBeDefined()
    expect(screen.getByText('Reject')).toBeDefined()
  })

  it('displays request params', () => {
    const request = createMockPendingRequest()
    mockStore.getState().addPendingRequest(request)

    render(<SignatureRequest />)

    const pre = screen.getByText(/0x1234/)
    expect(pre).toBeDefined()
  })

  it('calls resolve and clears on confirm click', () => {
    const request = createMockPendingRequest()
    mockStore.getState().addPendingRequest(request)

    render(<SignatureRequest />)
    fireEvent.click(screen.getByText('Confirm'))

    expect(request.resolve).toHaveBeenCalled()
    expect(mockStore.getState().pendingRequests).toEqual([])
  })

  it('calls reject and clears on reject click', () => {
    const request = createMockPendingRequest()
    mockStore.getState().addPendingRequest(request)

    render(<SignatureRequest />)
    fireEvent.click(screen.getByText('Reject'))

    expect(request.reject).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'User rejected the request' }),
    )
    expect(mockStore.getState().pendingRequests).toEqual([])
  })

  it('does not show pending count with a single request', () => {
    const request = createMockPendingRequest()
    mockStore.getState().addPendingRequest(request)

    render(<SignatureRequest />)

    expect(screen.queryByText(/more pending/)).toBeNull()
  })

  it('shows singular pending text for one extra request', () => {
    mockStore.getState().addPendingRequest(createMockPendingRequest())
    mockStore.getState().addPendingRequest(createMockPendingRequest())

    render(<SignatureRequest />)

    expect(screen.getByText('+1 more pending request')).toBeDefined()
  })

  it('shows pending count when multiple requests are queued', () => {
    mockStore.getState().addPendingRequest(createMockPendingRequest())
    mockStore.getState().addPendingRequest(createMockPendingRequest())
    mockStore.getState().addPendingRequest(createMockPendingRequest())

    render(<SignatureRequest />)

    expect(screen.getByText('+2 more pending requests')).toBeDefined()
  })

  it('rejects dangling requests on unmount', () => {
    const request = createMockPendingRequest()
    mockStore.getState().addPendingRequest(request)

    const { unmount } = render(<SignatureRequest />)
    unmount()

    expect(request.reject).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Confirmation listener unmounted' }),
    )
    expect(mockStore.getState().pendingRequests).toEqual([])
  })
})
