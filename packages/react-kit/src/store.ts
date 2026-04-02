import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { PendingRequest } from './types.js'

export type State = {
  pendingRequest: PendingRequest | null
  userConfirmationListenerActive: boolean
  setPendingRequest: (request: PendingRequest | null) => void
  setUserConfirmationListenerActive: (active: boolean) => void
}

export const createStore = () =>
  create<State>()(
    subscribeWithSelector((set) => ({
      pendingRequest: null,
      userConfirmationListenerActive: false,
      setPendingRequest: (request) => set({ pendingRequest: request }),
      setUserConfirmationListenerActive: (active) =>
        set({ userConfirmationListenerActive: active }),
    })),
  )
