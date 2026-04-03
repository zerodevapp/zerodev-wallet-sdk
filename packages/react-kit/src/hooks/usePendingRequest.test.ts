import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createStore } from '../store'
import type { PendingRequest } from '../types'

// Mock wagmi's useConfig to return a connector with getKitStore
const mockStore = createStore()

vi.mock('wagmi', () => ({
  useConfig: () => ({
    connectors: [
      {
        id: 'zerodev-wallet',
        getKitStore: () => mockStore,
      },
    ],
  }),
}))

import { usePendingRequest } from './usePendingRequest'

function createMockPendingRequest(
  overrides?: Partial<PendingRequest>,
): PendingRequest {
  return {
    id: 'test-id',
    method: 'eth_sendTransaction',
    params: [{ to: '0x1234', value: '0x0' }],
    resolve: vi.fn(),
    reject: vi.fn(),
    ...overrides,
  } as PendingRequest
}

afterEach(() => {
  cleanup()
  // Reset store between tests
  mockStore.getState().setPendingRequest(null)
  mockStore.getState().setUserConfirmationListenerActive(false)
})

describe('usePendingRequest', () => {
  describe('register / deregister', () => {
    it('register sets userConfirmationListenerActive to true', () => {
      const { result } = renderHook(() => usePendingRequest())

      act(() => result.current.register())

      expect(mockStore.getState().userConfirmationListenerActive).toBe(true)
    })

    it('deregister sets userConfirmationListenerActive to false', () => {
      mockStore.getState().setUserConfirmationListenerActive(true)
      const { result } = renderHook(() => usePendingRequest())

      act(() => result.current.deregister())

      expect(mockStore.getState().userConfirmationListenerActive).toBe(false)
    })

    it('deregister rejects pending request if one exists', () => {
      const request = createMockPendingRequest()
      mockStore.getState().setPendingRequest(request)
      const { result } = renderHook(() => usePendingRequest())

      act(() => result.current.deregister())

      expect(request.reject).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Confirmation listener unmounted' }),
      )
      expect(mockStore.getState().pendingRequest).toBeNull()
    })
  })

  describe('confirm', () => {
    it('resolves pending request and clears it', () => {
      const request = createMockPendingRequest()
      mockStore.getState().setPendingRequest(request)
      const { result } = renderHook(() => usePendingRequest())

      act(() => result.current.confirm())

      expect(request.resolve).toHaveBeenCalled()
      expect(mockStore.getState().pendingRequest).toBeNull()
      expect(result.current.pendingRequest).toBeNull()
    })

    it('is a no-op when no pending request', () => {
      const { result } = renderHook(() => usePendingRequest())

      act(() => result.current.confirm())

      expect(mockStore.getState().pendingRequest).toBeNull()
    })
  })

  describe('reject', () => {
    it('rejects pending request and clears it', () => {
      const request = createMockPendingRequest()
      mockStore.getState().setPendingRequest(request)
      const { result } = renderHook(() => usePendingRequest())

      act(() => result.current.reject())

      expect(request.reject).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'User rejected the request' }),
      )
      expect(mockStore.getState().pendingRequest).toBeNull()
      expect(result.current.pendingRequest).toBeNull()
    })

    it('is a no-op when no pending request', () => {
      const { result } = renderHook(() => usePendingRequest())

      act(() => result.current.reject())

      expect(mockStore.getState().pendingRequest).toBeNull()
    })
  })

  describe('pendingRequest state', () => {
    it('syncs initial pending request from store', () => {
      const request = createMockPendingRequest()
      mockStore.getState().setPendingRequest(request)

      const { result } = renderHook(() => usePendingRequest())

      expect(result.current.pendingRequest).toBe(request)
    })

    it('updates when store pendingRequest changes', () => {
      const { result } = renderHook(() => usePendingRequest())
      expect(result.current.pendingRequest).toBeNull()

      const request = createMockPendingRequest()
      act(() => mockStore.getState().setPendingRequest(request))

      expect(result.current.pendingRequest).toBe(request)
    })

    it('clears when store pendingRequest is set to null', () => {
      const request = createMockPendingRequest()
      mockStore.getState().setPendingRequest(request)
      const { result } = renderHook(() => usePendingRequest())

      act(() => mockStore.getState().setPendingRequest(null))

      expect(result.current.pendingRequest).toBeNull()
    })
  })
})
