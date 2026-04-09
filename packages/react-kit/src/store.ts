import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { type AuthSlice, createAuthSlice } from './auth/authSlice'
import type { PendingRequest } from './types.js'

export type State = {
  pendingRequest: PendingRequest | null
  userConfirmationListenerActive: boolean
  setPendingRequest: (request: PendingRequest | null) => void
  setUserConfirmationListenerActive: (active: boolean) => void
} & AuthSlice

export const createStore = () =>
  create<State>()(
    subscribeWithSelector((...a) => ({
      pendingRequest: null,
      userConfirmationListenerActive: false,
      setPendingRequest: (request) => a[0]({ pendingRequest: request }),
      setUserConfirmationListenerActive: (active) =>
        a[0]({ userConfirmationListenerActive: active }),

      ...createAuthSlice(...a),
    })),
  )
