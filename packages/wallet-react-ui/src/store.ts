import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import {
  type AuthStoreSlice,
  createAuthStoreSlice,
} from './auth/authStoreSlice'
import type { EvmConnectionAtLoad } from './solana/evmAdoptionGuard'
import {
  createSolanaStoreSlice,
  type SolanaStoreSlice,
} from './solana/solanaStoreSlice'
import type { PendingRequest } from './types.js'

export type State = {
  pendingRequests: PendingRequest[]
  userConfirmationListenerActive: boolean
  /** The EVM connections wagmi had persisted when the page loaded, taken by
   * the kit connector before wagmi's config creation overwrites the record
   * (see `readEvmConnectionsAtLoad`). Null until a connector sets it. */
  evmConnectionsAtLoad: Promise<readonly EvmConnectionAtLoad[] | null>
  setEvmConnectionsAtLoad: (
    connections: Promise<readonly EvmConnectionAtLoad[] | null>,
  ) => void
  addPendingRequest: (request: PendingRequest) => void
  removePendingRequest: (id: string) => void
  clearPendingRequests: () => void
  setUserConfirmationListenerActive: (active: boolean) => void
} & AuthStoreSlice &
  SolanaStoreSlice

export const createStore = () =>
  create<State>()(
    subscribeWithSelector((set, get, store) => ({
      pendingRequests: [],
      userConfirmationListenerActive: false,
      evmConnectionsAtLoad: Promise.resolve(null),
      setEvmConnectionsAtLoad: (connections) =>
        set({ evmConnectionsAtLoad: connections }),
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
      ...createSolanaStoreSlice(set, get, store),
    })),
  )
