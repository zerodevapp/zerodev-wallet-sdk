import { describe, expect, it, vi } from 'vitest'
import { createStore } from './store'
import type { PendingRequest } from './types'

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

describe('store', () => {
  it('has correct initial state', () => {
    const store = createStore()
    const state = store.getState()

    expect(state.pendingRequest).toBeNull()
    expect(state.userConfirmationListenerActive).toBe(false)
  })

  it('sets and clears pending request', () => {
    const store = createStore()
    const request = createMockPendingRequest()

    store.getState().setPendingRequest(request)
    expect(store.getState().pendingRequest).toBe(request)

    store.getState().setPendingRequest(null)
    expect(store.getState().pendingRequest).toBeNull()
  })

  it('toggles userConfirmationListenerActive', () => {
    const store = createStore()

    store.getState().setUserConfirmationListenerActive(true)
    expect(store.getState().userConfirmationListenerActive).toBe(true)

    store.getState().setUserConfirmationListenerActive(false)
    expect(store.getState().userConfirmationListenerActive).toBe(false)
  })

  it('fires subscription on pendingRequest change', () => {
    const store = createStore()
    const listener = vi.fn()
    const request = createMockPendingRequest()

    store.subscribe((state) => state.pendingRequest, listener)

    store.getState().setPendingRequest(request)
    expect(listener).toHaveBeenCalledWith(request, null)

    store.getState().setPendingRequest(null)
    expect(listener).toHaveBeenCalledWith(null, request)
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('does not fire subscription when unrelated state changes', () => {
    const store = createStore()
    const listener = vi.fn()

    store.subscribe((state) => state.pendingRequest, listener)

    store.getState().setUserConfirmationListenerActive(true)
    expect(listener).not.toHaveBeenCalled()
  })

  it('each createStore returns an independent instance', () => {
    const store1 = createStore()
    const store2 = createStore()
    const request = createMockPendingRequest()

    store1.getState().setPendingRequest(request)

    expect(store1.getState().pendingRequest).toBe(request)
    expect(store2.getState().pendingRequest).toBeNull()
  })
})
