'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { UserRejectedRequestError } from 'viem'
import { useConfig } from 'wagmi'
import { getStore } from '../../shared/utils/store.js'
import type { State } from '../../store.js'
import type { PendingRequest, Store } from '../../types.js'

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
      head.reject(
        new UserRejectedRequestError(new Error('User rejected the request')),
      )
      state.removePendingRequest(head.id)
    }
  }, [])

  const pendingRequest = pendingRequests[0] ?? null

  return { pendingRequest, pendingRequests, confirm, reject }
}
