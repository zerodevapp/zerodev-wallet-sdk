'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useConfig } from 'wagmi'
import type { PendingRequest, ZeroDevWalletState } from '../store.js'

function getZeroDevConnector(config: ReturnType<typeof useConfig>) {
  return config.connectors.find((c) => c.id === 'zerodev-wallet')
}

export function usePendingRequest() {
  const config = useConfig()
  const [pendingRequest, setPendingRequestState] =
    useState<PendingRequest | null>(null)
  const storeRef = useRef<any>(null)
  const registered = useRef(false)

  useEffect(() => {
    let cancelled = false
    let unsubscribe: (() => void) | undefined

    const connector = getZeroDevConnector(config)
    if (!connector) return

    // @ts-expect-error - getStore is a custom method
    connector.getStore().then((store: any) => {
      if (cancelled) return
      storeRef.current = store

      // Apply deferred registration
      if (registered.current) {
        store.getState().setUserConfirmationListenerActive(true)
      }

      // Sync initial state
      setPendingRequestState(store.getState().pendingRequest)

      // Subscribe to changes
      unsubscribe = store.subscribe(
        (state: ZeroDevWalletState) => state.pendingRequest,
        (req: PendingRequest | null) => {
          if (!cancelled) setPendingRequestState(req)
        },
      )
    })

    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [config])

  const confirm = useCallback(() => {
    const store = storeRef.current
    if (!store) return
    const state = store.getState() as ZeroDevWalletState
    if (state.pendingRequest) {
      state.pendingRequest.resolve()
      state.setPendingRequest(null)
    }
  }, [])

  const reject = useCallback(() => {
    const store = storeRef.current
    if (!store) return
    const state = store.getState() as ZeroDevWalletState
    if (state.pendingRequest) {
      state.pendingRequest.reject(new Error('User rejected the request'))
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
      const state = storeRef.current.getState() as ZeroDevWalletState
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
