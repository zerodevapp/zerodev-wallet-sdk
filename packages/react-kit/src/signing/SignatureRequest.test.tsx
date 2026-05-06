import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
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

import { SignatureRequest } from './index'

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

    expect(screen.getByText('Confirm Transaction')).toBeDefined()
    expect(screen.getByText('Confirm')).toBeDefined()
    expect(screen.getByText('Reject')).toBeDefined()
  })

  it('displays request params', () => {
    const request = createMockPendingRequest()
    mockStore.getState().addPendingRequest(request)

    render(<SignatureRequest />)

    // Transaction Summary starts collapsed; expand it to reveal params.
    const [toggleButton] = screen.getAllByRole('button')
    fireEvent.click(toggleButton)

    expect(screen.getByText(/0x1234/)).toBeDefined()
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

  describe('custom UI via children function', () => {
    it('invokes children with pendingRequest: null when the queue is empty', () => {
      const renderFn = vi.fn(() => <div data-testid="custom" />)
      render(<SignatureRequest>{renderFn}</SignatureRequest>)

      expect(renderFn).toHaveBeenCalledWith(
        expect.objectContaining({ pendingRequest: null }),
      )
      expect(screen.getByTestId('custom')).toBeDefined()
    })

    it('invokes children with the queued pendingRequest when one is queued', () => {
      const request = createMockPendingRequest()
      mockStore.getState().addPendingRequest(request)

      const renderFn = vi.fn(() => null)
      render(<SignatureRequest>{renderFn}</SignatureRequest>)

      expect(renderFn).toHaveBeenLastCalledWith(
        expect.objectContaining({
          pendingRequest: expect.objectContaining({ id: request.id }),
        }),
      )
    })

    it('invokes children with the head pendingRequest when multiple are queued', () => {
      const first = createMockPendingRequest()
      const second = createMockPendingRequest()
      mockStore.getState().addPendingRequest(first)
      mockStore.getState().addPendingRequest(second)

      const renderFn = vi.fn(() => null)
      render(<SignatureRequest>{renderFn}</SignatureRequest>)

      expect(renderFn).toHaveBeenLastCalledWith(
        expect.objectContaining({
          pendingRequest: expect.objectContaining({ id: first.id }),
        }),
      )
    })

    it('confirm() resolves the active request and removes it from the queue', () => {
      const request = createMockPendingRequest()
      mockStore.getState().addPendingRequest(request)

      let confirmFn: (() => void) | undefined
      render(
        <SignatureRequest>
          {({ confirm }) => {
            confirmFn = confirm
            return null
          }}
        </SignatureRequest>,
      )

      act(() => confirmFn?.())
      expect(request.resolve).toHaveBeenCalled()
      expect(mockStore.getState().pendingRequests).toEqual([])
    })

    it('activates the confirmation listener (same as default)', () => {
      render(<SignatureRequest>{() => null}</SignatureRequest>)
      expect(mockStore.getState().userConfirmationListenerActive).toBe(true)
    })
  })

  describe('default UI via controlled props', () => {
    it('renders the default UI from the request prop', () => {
      render(
        <SignatureRequest
          request={{
            method: 'eth_sendTransaction',
            params: [{ to: '0x1234', value: '0x0' }],
          }}
          onConfirm={vi.fn()}
          onReject={vi.fn()}
        />,
      )

      expect(screen.getByText('Confirm')).toBeDefined()
      expect(screen.getByText('Reject')).toBeDefined()
    })

    it('invokes onConfirm/onReject directly without touching the store', () => {
      const onConfirm = vi.fn()
      const onReject = vi.fn()
      render(
        <SignatureRequest
          request={{
            method: 'eth_sendTransaction',
            params: [{ to: '0x1234', value: '0x0' }],
          }}
          onConfirm={onConfirm}
          onReject={onReject}
        />,
      )

      fireEvent.click(screen.getByText('Confirm'))
      expect(onConfirm).toHaveBeenCalled()

      fireEvent.click(screen.getByText('Reject'))
      expect(onReject).toHaveBeenCalled()

      expect(mockStore.getState().pendingRequests).toEqual([])
    })

    it('does NOT activate the confirmation listener', () => {
      render(
        <SignatureRequest
          request={{
            method: 'eth_sendTransaction',
            params: [{ to: '0x1234', value: '0x0' }],
          }}
          onConfirm={vi.fn()}
          onReject={vi.fn()}
        />,
      )

      expect(mockStore.getState().userConfirmationListenerActive).toBe(false)
    })

    it('ignores any pending request in the store', () => {
      mockStore.getState().addPendingRequest(
        createMockPendingRequest({
          method: 'personal_sign',
          params: ['0xdead', '0xbeef'],
        }),
      )

      render(
        <SignatureRequest
          request={{
            method: 'eth_sendTransaction',
            params: [{ to: '0x1234', value: '0x0' }],
          }}
          onConfirm={vi.fn()}
          onReject={vi.fn()}
        />,
      )

      expect(screen.queryByText(/Sign Message/i)).toBeNull()
    })
  })
})
