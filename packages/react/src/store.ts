import type {
  KernelAccountClient,
  KernelSmartAccountImplementation,
} from '@zerodev/sdk'
import type {
  ZeroDevWalletSDK,
  ZeroDevWalletSession,
} from '@zerodev/wallet-core'
import type { LocalAccount, RpcTransactionRequest } from 'viem'
import type { SmartAccount } from 'viem/account-abstraction'
import { create } from 'zustand'
import { persist, subscribeWithSelector } from 'zustand/middleware'

// Internal OAuth config stored in the state (derived from connector params)
type InternalOAuthConfig = {
  backendUrl: string
  projectId: string
}

// Pending request types for user confirmation
export type PendingRequestParams =
  | {
      kind: 'transaction'
      method: 'eth_sendTransaction' | 'wallet_sendTransaction'
      params: RpcTransactionRequest
    }
  | {
      kind: 'sign'
      method: 'personal_sign'
      params: { message: string; address: string }
    }
  | {
      kind: 'sign'
      method: 'eth_signTypedData_v4'
      params: { address: string; typedData: string }
    }

export type PendingRequest = {
  id: string
  resolve: (value?: unknown) => void
  reject: (reason?: unknown) => void
} & PendingRequestParams

export type ZeroDevWalletState = {
  // Core
  wallet: ZeroDevWalletSDK | null
  eoaAccount: LocalAccount | null
  session: ZeroDevWalletSession | null

  // Multi-chain support
  activeChainId: number | null
  kernelAccounts: Map<number, SmartAccount<KernelSmartAccountImplementation>>
  kernelClients: Map<number, KernelAccountClient>

  // Session expiry
  isExpiring: boolean

  // OAuth config (derived from connector params)
  oauthConfig: InternalOAuthConfig | null

  // User confirmation
  pendingRequest: PendingRequest | null
  userConfirmationListenerActive: boolean

  // Actions
  setWallet: (wallet: ZeroDevWalletSDK) => void
  setEoaAccount: (account: LocalAccount | null) => void
  setKernelAccount: (
    chainId: number,
    account: SmartAccount<KernelSmartAccountImplementation>,
  ) => void
  setKernelClient: (chainId: number, client: KernelAccountClient) => void
  setSession: (session: ZeroDevWalletSession | null) => void
  setActiveChainId: (chainId: number | null) => void
  setIsExpiring: (isExpiring: boolean) => void
  setOAuthConfig: (config: InternalOAuthConfig | null) => void
  setPendingRequest: (request: PendingRequest | null) => void
  setUserConfirmationListenerActive: (active: boolean) => void
  clear: () => void
}

export const createZeroDevWalletStore = () =>
  create<ZeroDevWalletState>()(
    subscribeWithSelector(
      persist(
        (set, get) => ({
          // Initial state
          wallet: null,
          eoaAccount: null,
          session: null,
          activeChainId: null,
          kernelAccounts: new Map(),
          kernelClients: new Map(),
          isExpiring: false,
          oauthConfig: null,
          pendingRequest: null,
          userConfirmationListenerActive: false,

          // Actions
          setWallet: (wallet) => set({ wallet }),

          setEoaAccount: (account) => set({ eoaAccount: account }),

          setKernelAccount: (chainId, account) => {
            const accounts = new Map(get().kernelAccounts)
            accounts.set(chainId, account)
            set({ kernelAccounts: accounts })
          },

          setKernelClient: (chainId, client) => {
            const clients = new Map(get().kernelClients)
            clients.set(chainId, client)
            set({ kernelClients: clients })
          },

          setSession: (session) => set({ session }),

          setActiveChainId: (chainId) => set({ activeChainId: chainId }),

          setIsExpiring: (isExpiring) => set({ isExpiring }),

          setOAuthConfig: (config) => set({ oauthConfig: config }),

          setPendingRequest: (request) => set({ pendingRequest: request }),

          setUserConfirmationListenerActive: (active) =>
            set({ userConfirmationListenerActive: active }),

          clear: () =>
            set({
              eoaAccount: null,
              session: null,
              kernelAccounts: new Map(),
              kernelClients: new Map(),
              isExpiring: false,
              activeChainId: null,
            }),
        }),
        {
          name: 'zerodev-wallet',
          // Only persist session data, not clients or accounts
          partialize: (state) => ({
            session: state.session,
            activeChainId: state.activeChainId,
          }),
        },
      ),
    ),
  )
