'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useConfig } from 'wagmi'
import type { createStore, State } from '../../store.js'
import type { PendingRequest } from '../../types.js'

type Store = ReturnType<typeof createStore>

function getStore(config: ReturnType<typeof useConfig>): Store | null {
  const connector = config.connectors.find((c) => c.id === 'zerodev-wallet')
  if (!connector || !('getKitStore' in connector)) return null
  // @ts-expect-error - getKitStore is a custom method on the kit connector
  return connector.getKitStore()
}

export function usePendingRequest() {
  const config = useConfig()
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([])
  const storeRef = useRef<Store | null>(null)

  useEffect(() => {
    const store = getStore(config)
    if (!store) return

    storeRef.current = store
    store.getState().setUserConfirmationListenerActive(true)

    // Sync initial state
    setPendingRequests(store.getState().pendingRequests)

    // Subscribe to changes
    const unsubscribe = store.subscribe(
      (state: State) => state.pendingRequests,
      (reqs: PendingRequest[]) => setPendingRequests(reqs),
    )

    return () => {
      unsubscribe()
      const state = store.getState()
      for (const req of state.pendingRequests) {
        req.reject(new Error('Confirmation listener unmounted'))
      }
      state.clearPendingRequests()
      state.setUserConfirmationListenerActive(false)
    }
  }, [config])

  const confirm = useCallback(() => {
    const store = storeRef.current
    if (!store) return
    const state = store.getState()
    const head = state.pendingRequests[0]
    if (head) {
      head.resolve()
      state.removePendingRequest(head.id)
    }
  }, [])

  const reject = useCallback(() => {
    const store = storeRef.current
    if (!store) return
    const state = store.getState()
    const head = state.pendingRequests[0]
    if (head) {
      head.reject(new Error('User rejected the request'))
      state.removePendingRequest(head.id)
    }
  }, [])

  const pendingRequest = pendingRequests[0] ?? null

  return { pendingRequest, pendingRequests, confirm, reject }
}
