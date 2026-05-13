import type {
  KernelAccountClient,
  KernelSmartAccountImplementation,
} from '@zerodev/sdk'
import type {
  ZeroDevWalletSDK,
  ZeroDevWalletSession,
} from '@zerodev/wallet-core'
import type { Chain, LocalAccount, Transport, WalletClient } from 'viem'
import type { SmartAccount } from 'viem/account-abstraction'
import { create } from 'zustand'
import {
  createJSONStorage,
  persist,
  type StateStorage,
  subscribeWithSelector,
} from 'zustand/middleware'

// Internal OAuth config stored in the state (derived from connector params)
type InternalOAuthConfig = {
  backendUrl: string
  projectId: string
}

export type ZeroDevWalletState = {
  // Core
  wallet: ZeroDevWalletSDK | null
  eoaAccount: LocalAccount | null
  session: ZeroDevWalletSession | null

  // Multi-chain support
  activeChainId: number | null
  kernelAccounts: Map<number, SmartAccount<KernelSmartAccountImplementation>>
  kernelClients: Map<number, KernelAccountClient>
  /**
   * Per-chain viem WalletClient for EOA-mode connectors. Populated only when
   * the connector is configured with `mode: 'EOA'`. For 4337/7702 modes the
   * corresponding `kernelClient` is used instead.
   */
  walletClients: Map<number, WalletClient<Transport, Chain, LocalAccount>>

  // Session expiry
  isExpiring: boolean

  // OAuth config (derived from connector params)
  oauthConfig: InternalOAuthConfig | null

  // Actions
  setWallet: (wallet: ZeroDevWalletSDK) => void
  setEoaAccount: (account: LocalAccount | null) => void
  setKernelAccount: (
    chainId: number,
    account: SmartAccount<KernelSmartAccountImplementation>,
  ) => void
  setKernelClient: (chainId: number, client: KernelAccountClient) => void
  setWalletClient: (
    chainId: number,
    client: WalletClient<Transport, Chain, LocalAccount>,
  ) => void
  setSession: (session: ZeroDevWalletSession | null) => void
  setActiveChainId: (chainId: number | null) => void
  setIsExpiring: (isExpiring: boolean) => void
  setOAuthConfig: (config: InternalOAuthConfig | null) => void
  clear: () => void
}

export type CreateStoreOptions = {
  storage?: StateStorage<void>
}

export const createZeroDevWalletStore = (options?: CreateStoreOptions) =>
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
          walletClients: new Map(),
          isExpiring: false,
          oauthConfig: null,

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

          setWalletClient: (chainId, client) => {
            const clients = new Map(get().walletClients)
            clients.set(chainId, client)
            set({ walletClients: clients })
          },

          setSession: (session) => set({ session }),

          setActiveChainId: (chainId) => set({ activeChainId: chainId }),

          setIsExpiring: (isExpiring) => set({ isExpiring }),

          setOAuthConfig: (config) => set({ oauthConfig: config }),

          clear: () =>
            set({
              eoaAccount: null,
              session: null,
              kernelAccounts: new Map(),
              kernelClients: new Map(),
              walletClients: new Map(),
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
          ...(options?.storage && {
            storage: createJSONStorage(() => options.storage!),
          }),
        },
      ),
    ),
  )
