import { describe, expect, it, vi } from 'vitest'
import { createStore } from './store'
import type { PendingRequest } from './types'

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

describe('store', () => {
  it('has correct initial state', () => {
    const store = createStore()
    const state = store.getState()

    expect(state.pendingRequests).toEqual([])
    expect(state.userConfirmationListenerActive).toBe(false)
  })

  it('adds pending requests to the queue', () => {
    const store = createStore()
    const request1 = createMockPendingRequest()
    const request2 = createMockPendingRequest()

    store.getState().addPendingRequest(request1)
    expect(store.getState().pendingRequests).toEqual([request1])

    store.getState().addPendingRequest(request2)
    expect(store.getState().pendingRequests).toEqual([request1, request2])
  })

  it('removes a pending request by id', () => {
    const store = createStore()
    const request1 = createMockPendingRequest()
    const request2 = createMockPendingRequest()

    store.getState().addPendingRequest(request1)
    store.getState().addPendingRequest(request2)

    store.getState().removePendingRequest(request1.id)
    expect(store.getState().pendingRequests).toEqual([request2])
  })

  it('removing a non-existent id is a no-op', () => {
    const store = createStore()
    const request = createMockPendingRequest()

    store.getState().addPendingRequest(request)
    store.getState().removePendingRequest('non-existent')

    expect(store.getState().pendingRequests).toEqual([request])
  })

  it('clears all pending requests', () => {
    const store = createStore()
    const request1 = createMockPendingRequest()
    const request2 = createMockPendingRequest()

    store.getState().addPendingRequest(request1)
    store.getState().addPendingRequest(request2)

    store.getState().clearPendingRequests()
    expect(store.getState().pendingRequests).toEqual([])
  })

  it('toggles userConfirmationListenerActive', () => {
    const store = createStore()

    store.getState().setUserConfirmationListenerActive(true)
    expect(store.getState().userConfirmationListenerActive).toBe(true)

    store.getState().setUserConfirmationListenerActive(false)
    expect(store.getState().userConfirmationListenerActive).toBe(false)
  })

  it('fires subscription on pendingRequests change', () => {
    const store = createStore()
    const listener = vi.fn()
    const request = createMockPendingRequest()

    store.subscribe((state) => state.pendingRequests, listener)

    store.getState().addPendingRequest(request)
    expect(listener).toHaveBeenCalledWith([request], [])

    store.getState().removePendingRequest(request.id)
    expect(listener).toHaveBeenCalledWith([], [request])
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('does not fire subscription when unrelated state changes', () => {
    const store = createStore()
    const listener = vi.fn()

    store.subscribe((state) => state.pendingRequests, listener)

    store.getState().setUserConfirmationListenerActive(true)
    expect(listener).not.toHaveBeenCalled()
  })

  it('each createStore returns an independent instance', () => {
    const store1 = createStore()
    const store2 = createStore()
    const request = createMockPendingRequest()

    store1.getState().addPendingRequest(request)

    expect(store1.getState().pendingRequests).toEqual([request])
    expect(store2.getState().pendingRequests).toEqual([])
  })

  describe('auth slice', () => {
    it('includes auth slice in initial state', () => {
      const store = createStore()
      const state = store.getState()

      expect(state.auth).toBeDefined()
      expect(state.auth.step).toBe('initializing')
      expect(state.auth.stepHistory).toEqual([])
      expect(state.auth.enabledMethods).toEqual([])
      expect(state.auth.email).toBeNull()
      expect(state.auth.otpId).toBeNull()
      expect(state.auth.config).toBeNull()
    })

    it('auth and pending requests state are independent', () => {
      const store = createStore()
      const request = createMockPendingRequest()

      store.getState().addPendingRequest(request)
      store.getState().auth.setEmail('test@example.com')

      expect(store.getState().pendingRequests).toHaveLength(1)
      expect(store.getState().auth.email).toBe('test@example.com')
    })

    it('subscriptions work for both slices', () => {
      const store = createStore()
      const requestListener = vi.fn()
      const authListener = vi.fn()
      const request = createMockPendingRequest()

      store.subscribe((state) => state.pendingRequests, requestListener)
      store.subscribe((state) => state.auth.step, authListener)

      store.getState().addPendingRequest(request)
      expect(requestListener).toHaveBeenCalledTimes(1)
      expect(authListener).not.toHaveBeenCalled()

      store.getState().auth.goToStep('sign-up')
      expect(authListener).toHaveBeenCalledTimes(1)
      expect(requestListener).toHaveBeenCalledTimes(1)
    })
  })
})
