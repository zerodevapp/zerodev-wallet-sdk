import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { type AuthSlice, createAuthSlice } from './auth/authSlice'
import type { PendingRequest } from './types.js'

export type State = {
  pendingRequests: PendingRequest[]
  userConfirmationListenerActive: boolean
  addPendingRequest: (request: PendingRequest) => void
  removePendingRequest: (id: string) => void
  clearPendingRequests: () => void
  setUserConfirmationListenerActive: (active: boolean) => void
} & AuthSlice

export const createStore = () =>
  create<State>()(
    subscribeWithSelector((set, get, store) => ({
      pendingRequests: [],
      userConfirmationListenerActive: false,
      addPendingRequest: (request) =>
        set((state) => ({
          pendingRequests: [...state.pendingRequests, request],
        })),
      removePendingRequest: (id) =>
        set((state) => ({
          pendingRequests: state.pendingRequests.filter((r) => r.id !== id),
        })),
      clearPendingRequests: () => set({ pendingRequests: [] }),
      setUserConfirmationListenerActive: (active) =>
        set({ userConfirmationListenerActive: active }),

      ...createAuthSlice(set, get, store),
    })),
  )
