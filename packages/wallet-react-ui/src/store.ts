import type { ReactNode } from 'react'
import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import {
  type AuthStoreSlice,
  createAuthStoreSlice,
} from './auth/authStoreSlice'
import type { PendingRequest } from './types.js'

export type State = {
  pendingRequests: PendingRequest[]
  userConfirmationListenerActive: boolean
  logo: ReactNode | null
  walletConnectProjectId: string | null
  addPendingRequest: (request: PendingRequest) => void
  removePendingRequest: (id: string) => void
  clearPendingRequests: () => void
  setUserConfirmationListenerActive: (active: boolean) => void
} & AuthStoreSlice

export type CreateStoreOptions = {
  logo?: ReactNode
  walletConnectProjectId?: string
}

export const createStore = (options: CreateStoreOptions = {}) =>
  create<State>()(
    subscribeWithSelector((set, get, store) => ({
      pendingRequests: [],
      userConfirmationListenerActive: false,
      logo: options.logo ?? null,
      walletConnectProjectId: options.walletConnectProjectId ?? null,
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

      ...createAuthStoreSlice(set, get, store),
    })),
  )
