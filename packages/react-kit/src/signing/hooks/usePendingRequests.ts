'use client'

import { useEffect, useState } from 'react'
import { useConfig } from 'wagmi'
import type { State } from '../../store.js'
import type { PendingRequest } from '../../types.js'
import { getStore } from './usePendingRequest.js'

// Pure subscription to the pending request queue. Does NOT register as a
// confirmation listener — use this when you only need to read state (e.g. to
// drive overlay layout from a parent component). For interactive UIs that
// confirm/reject requests, use `usePendingRequest`, which both registers the
// listener and exposes `confirm` / `reject`.
export function usePendingRequests(): PendingRequest[] {
  const config = useConfig()
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([])

  useEffect(() => {
    const store = getStore(config)
    if (!store) return

    setPendingRequests(store.getState().pendingRequests)

    return store.subscribe(
      (state: State) => state.pendingRequests,
      (reqs: PendingRequest[]) => setPendingRequests(reqs),
    )
  }, [config])

  return pendingRequests
}
