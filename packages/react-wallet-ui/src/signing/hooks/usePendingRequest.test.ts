import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createStore } from '../../store'
import type { PendingRequest } from '../../types'

// Mock wagmi's useConfig to return a connector with getKitStore.
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

import { usePendingRequest } from './usePendingRequest'

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

describe('usePendingRequest', () => {
  describe('lifecycle', () => {
    it('sets userConfirmationListenerActive to true on mount', () => {
      renderHook(() => usePendingRequest())

      expect(mockStore.getState().userConfirmationListenerActive).toBe(true)
    })

    it('sets userConfirmationListenerActive to false on unmount', () => {
      const { unmount } = renderHook(() => usePendingRequest())

      unmount()

      expect(mockStore.getState().userConfirmationListenerActive).toBe(false)
    })

    it('rejects all pending requests on unmount', () => {
      const request1 = createMockPendingRequest()
      const request2 = createMockPendingRequest()
      mockStore.getState().addPendingRequest(request1)
      mockStore.getState().addPendingRequest(request2)
      const { unmount } = renderHook(() => usePendingRequest())

      unmount()

      expect(request1.reject).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Confirmation listener unmounted' }),
      )
      expect(request2.reject).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Confirmation listener unmounted' }),
      )
      expect(mockStore.getState().pendingRequests).toEqual([])
    })
  })

  describe('confirm', () => {
    it('resolves head request and removes it', () => {
      const request = createMockPendingRequest()
      mockStore.getState().addPendingRequest(request)
      const { result } = renderHook(() => usePendingRequest())

      act(() => result.current.confirm())

      expect(request.resolve).toHaveBeenCalled()
      expect(mockStore.getState().pendingRequests).toEqual([])
      expect(result.current.pendingRequest).toBeNull()
    })

    it('confirms first and second becomes head', () => {
      const request1 = createMockPendingRequest()
      const request2 = createMockPendingRequest()
      mockStore.getState().addPendingRequest(request1)
      mockStore.getState().addPendingRequest(request2)
      const { result } = renderHook(() => usePendingRequest())

      act(() => result.current.confirm())

      expect(request1.resolve).toHaveBeenCalled()
      expect(request2.resolve).not.toHaveBeenCalled()
      expect(result.current.pendingRequest).toBe(request2)
      expect(mockStore.getState().pendingRequests).toEqual([request2])
    })

    it('is a no-op when no pending requests', () => {
      const { result } = renderHook(() => usePendingRequest())

      act(() => result.current.confirm())

      expect(mockStore.getState().pendingRequests).toEqual([])
    })
  })

  describe('reject', () => {
    it('rejects head request and removes it', () => {
      const request = createMockPendingRequest()
      mockStore.getState().addPendingRequest(request)
      const { result } = renderHook(() => usePendingRequest())

      act(() => result.current.reject())

      expect(request.reject).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'UserRejectedRequestError',
          code: 4001,
        }),
      )
      expect(mockStore.getState().pendingRequests).toEqual([])
      expect(result.current.pendingRequest).toBeNull()
    })

    it('rejects first and second becomes head', () => {
      const request1 = createMockPendingRequest()
      const request2 = createMockPendingRequest()
      mockStore.getState().addPendingRequest(request1)
      mockStore.getState().addPendingRequest(request2)
      const { result } = renderHook(() => usePendingRequest())

      act(() => result.current.reject())

      expect(request1.reject).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'UserRejectedRequestError',
          code: 4001,
        }),
      )
      expect(request2.reject).not.toHaveBeenCalled()
      expect(result.current.pendingRequest).toBe(request2)
      expect(mockStore.getState().pendingRequests).toEqual([request2])
    })

    it('is a no-op when no pending requests', () => {
      const { result } = renderHook(() => usePendingRequest())

      act(() => result.current.reject())

      expect(mockStore.getState().pendingRequests).toEqual([])
    })
  })

  describe('pendingRequest state', () => {
    it('syncs initial head request from store', () => {
      const request = createMockPendingRequest()
      mockStore.getState().addPendingRequest(request)

      const { result } = renderHook(() => usePendingRequest())

      expect(result.current.pendingRequest).toBe(request)
    })

    it('updates head when a new request is added to an empty queue', () => {
      const { result } = renderHook(() => usePendingRequest())
      expect(result.current.pendingRequest).toBeNull()

      const request = createMockPendingRequest()
      act(() => mockStore.getState().addPendingRequest(request))

      expect(result.current.pendingRequest).toBe(request)
    })

    it('keeps the existing head when another request is queued behind it', () => {
      const request1 = createMockPendingRequest()
      mockStore.getState().addPendingRequest(request1)
      const { result } = renderHook(() => usePendingRequest())

      const request2 = createMockPendingRequest()
      act(() => mockStore.getState().addPendingRequest(request2))

      expect(result.current.pendingRequest).toBe(request1)
    })

    it('advances head when the current one is removed', () => {
      const request1 = createMockPendingRequest()
      const request2 = createMockPendingRequest()
      mockStore.getState().addPendingRequest(request1)
      mockStore.getState().addPendingRequest(request2)
      const { result } = renderHook(() => usePendingRequest())

      act(() => mockStore.getState().removePendingRequest(request1.id))

      expect(result.current.pendingRequest).toBe(request2)
    })

    it('clears head when last request is removed', () => {
      const request = createMockPendingRequest()
      mockStore.getState().addPendingRequest(request)
      const { result } = renderHook(() => usePendingRequest())

      act(() => mockStore.getState().removePendingRequest(request.id))

      expect(result.current.pendingRequest).toBeNull()
    })
  })
})
