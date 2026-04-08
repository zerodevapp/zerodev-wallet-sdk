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

  useEffect(() => {
    const store = getStore(config)
    if (!store) return

    storeRef.current = store
    store.getState().setUserConfirmationListenerActive(true)

    // Sync initial state
    setPendingRequestState(store.getState().pendingRequest)

    // Subscribe to changes
    const unsubscribe = store.subscribe(
      (state: State) => state.pendingRequest,
      (req: PendingRequest | null) => setPendingRequestState(req),
    )

    return () => {
      unsubscribe()
      const state = store.getState()
      if (state.pendingRequest) {
        state.pendingRequest.reject(
          new Error('Confirmation listener unmounted'),
        )
        state.setPendingRequest(null)
      }
      state.setUserConfirmationListenerActive(false)
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

  return { pendingRequest, confirm, reject }
}
