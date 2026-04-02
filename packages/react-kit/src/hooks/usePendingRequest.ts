'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useConfig } from 'wagmi'
import type { createStore, State } from '../store.js'
import type { PendingRequest } from '../types.js'

type Store = ReturnType<typeof createStore>

function getStore(config: ReturnType<typeof useConfig>): Store | null {
  const connector = config.connectors.find((c) => c.id === 'zerodev-wallet')
  if (!connector || !('getKitStore' in connector)) return null
  // @ts-expect-error - getKitStore is a custom method on the kit connector
  return connector.getKitStore()
}

export function usePendingRequest() {
  const config = useConfig()
  const [pendingRequest, setPendingRequestState] =
    useState<PendingRequest | null>(null)
  const storeRef = useRef<Store | null>(null)
  const registered = useRef(false)

  useEffect(() => {
    let cancelled = false
    let unsubscribe: (() => void) | undefined

    const store = getStore(config)
    if (!store) return

    storeRef.current = store

    // Apply deferred registration
    if (registered.current) {
      store.getState().setUserConfirmationListenerActive(true)
    }

    // Sync initial state
    setPendingRequestState(store.getState().pendingRequest)

    // Subscribe to changes
    unsubscribe = store.subscribe(
      (state: State) => state.pendingRequest,
      (req: PendingRequest | null) => {
        if (!cancelled) setPendingRequestState(req)
      },
    )

    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [config])

  const confirm = useCallback(() => {
    const store = storeRef.current
    if (!store) return
    const state = store.getState()
    if (state.pendingRequest) {
      state.pendingRequest.resolve()
      // todo: handle multiple requests (queue)
      state.setPendingRequest(null)
    }
  }, [])

  const reject = useCallback(() => {
    const store = storeRef.current
    if (!store) return
    const state = store.getState()
    if (state.pendingRequest) {
      state.pendingRequest.reject(new Error('User rejected the request'))
      // todo: handle multiple requests (queue)
      state.setPendingRequest(null)
    }
  }, [])

  const register = useCallback(() => {
    registered.current = true
    if (storeRef.current) {
      storeRef.current.getState().setUserConfirmationListenerActive(true)
    }
  }, [])

  const deregister = useCallback(() => {
    registered.current = false
    if (storeRef.current) {
      const state = storeRef.current.getState()
      if (state.pendingRequest) {
        state.pendingRequest.reject(
          new Error('Confirmation listener unmounted'),
        )
        state.setPendingRequest(null)
      }
      state.setUserConfirmationListenerActive(false)
    }
  }, [])

  return { pendingRequest, confirm, reject, register, deregister }
}
