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
  /** WalletConnect pairings the sign-up sheet preloaded (so a QR is ready
   * the moment it is asked for) that have not settled yet. wagmi reports a
   * pending connect as `connecting` whoever started it; the EVM adapter
   * reads this to tell a preload nobody is looking at from a connect the
   * host or the user asked for. See `useWalletConnectPairing`. */
  evmPairingPreloads: number
  beginEvmPairingPreload: () => void
  endEvmPairingPreload: () => void
  /** EVM connects the kit itself is running (`useZeroDevWalletKit`'s
   * `connect`), so the adapter keeps reporting `connecting` for them while
   * a preload is pending beside them. */
  evmConnects: number
  beginEvmConnect: () => void
  endEvmConnect: () => void
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
      evmPairingPreloads: 0,
      beginEvmPairingPreload: () =>
        set((state) => ({ evmPairingPreloads: state.evmPairingPreloads + 1 })),
      endEvmPairingPreload: () =>
        set((state) => ({ evmPairingPreloads: state.evmPairingPreloads - 1 })),
      evmConnects: 0,
      beginEvmConnect: () =>
        set((state) => ({ evmConnects: state.evmConnects + 1 })),
      endEvmConnect: () =>
        set((state) => ({ evmConnects: state.evmConnects - 1 })),
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
