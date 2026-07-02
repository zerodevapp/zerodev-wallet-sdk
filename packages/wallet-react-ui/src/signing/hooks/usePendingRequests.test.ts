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
import { usePendingRequests } from './usePendingRequests'

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

describe('usePendingRequests', () => {
  describe('lifecycle', () => {
    it('does NOT set userConfirmationListenerActive on mount', () => {
      renderHook(() => usePendingRequests())

      expect(mockStore.getState().userConfirmationListenerActive).toBe(false)
    })

    it('does NOT reject pending requests on unmount', () => {
      const request = createMockPendingRequest()
      mockStore.getState().addPendingRequest(request)
      const { unmount } = renderHook(() => usePendingRequests())

      unmount()

      expect(request.reject).not.toHaveBeenCalled()
      expect(mockStore.getState().pendingRequests).toEqual([request])
    })
  })

  describe('state', () => {
    it('syncs initial pending requests from store', () => {
      const request = createMockPendingRequest()
      mockStore.getState().addPendingRequest(request)

      const { result } = renderHook(() => usePendingRequests())

      expect(result.current).toEqual([request])
    })

    it('returns an empty array when the queue is empty', () => {
      const { result } = renderHook(() => usePendingRequests())

      expect(result.current).toEqual([])
    })

    it('updates when a new request is added', () => {
      const { result } = renderHook(() => usePendingRequests())

      const request = createMockPendingRequest()
      act(() => mockStore.getState().addPendingRequest(request))

      expect(result.current).toEqual([request])
    })

    it('updates when a request is removed', () => {
      const request1 = createMockPendingRequest()
      const request2 = createMockPendingRequest()
      mockStore.getState().addPendingRequest(request1)
      mockStore.getState().addPendingRequest(request2)
      const { result } = renderHook(() => usePendingRequests())

      act(() => mockStore.getState().removePendingRequest(request1.id))

      expect(result.current).toEqual([request2])
    })

    it('reflects multiple queued requests in order', () => {
      const request1 = createMockPendingRequest()
      const request2 = createMockPendingRequest()
      mockStore.getState().addPendingRequest(request1)
      mockStore.getState().addPendingRequest(request2)

      const { result } = renderHook(() => usePendingRequests())

      expect(result.current).toEqual([request1, request2])
    })
  })

  describe('coexistence with usePendingRequest', () => {
    it('does not interfere with usePendingRequest activating the listener', () => {
      renderHook(() => {
        usePendingRequest()
        usePendingRequests()
      })

      expect(mockStore.getState().userConfirmationListenerActive).toBe(true)
    })

    it('sees the same head as usePendingRequest', () => {
      const request = createMockPendingRequest()
      mockStore.getState().addPendingRequest(request)

      const { result } = renderHook(() => ({
        a: usePendingRequest(),
        b: usePendingRequests(),
      }))

      expect(result.current.a.pendingRequest).toBe(request)
      expect(result.current.b).toEqual([request])
    })
  })
})
