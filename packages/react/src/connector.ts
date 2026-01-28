import { type CreateConnectorFn, createConnector } from '@wagmi/core'
import {
  createKernelAccount,
  createKernelAccountClient,
  createZeroDevPaymasterClient,
} from '@zerodev/sdk'
import { getEntryPoint, KERNEL_V3_3 } from '@zerodev/sdk/constants'
import type { StorageAdapter } from '@zerodev/wallet-core'
import { createZeroDevWallet, KMS_SERVER_URL } from '@zerodev/wallet-core'
import { type Chain, createPublicClient, http } from 'viem'
import { handleOAuthCallback, type OAuthProvider } from './oauth.js'
import { createProvider } from './provider.js'
import { createZeroDevWalletStore } from './store.js'
import { getAAUrl } from './utils/aaUtils.js'

// OAuth URL parameter used to detect callback
const OAUTH_SUCCESS_PARAM = 'oauth_success'
const OAUTH_PROVIDER_PARAM = 'oauth_provider'

/**
 * Detect OAuth callback from URL params and handle it.
 * - If in popup: sends postMessage to opener and closes
 * - If not in popup: completes auth directly
 */
async function detectAndHandleOAuthCallback(
  wallet: Awaited<ReturnType<typeof createZeroDevWallet>>,
  store: ReturnType<typeof createZeroDevWalletStore>,
): Promise<boolean> {
  if (typeof window === 'undefined') return false

  const params = new URLSearchParams(window.location.search)
  const isOAuthCallback = params.get(OAUTH_SUCCESS_PARAM) === 'true'

  if (!isOAuthCallback) return false

  // If in popup, use the existing handler to notify opener
  if (window.opener) {
    handleOAuthCallback(OAUTH_SUCCESS_PARAM)
    return true
  }

  // Not in popup - complete auth directly (redirect flow)
  console.log('OAuth callback detected, completing authentication...')
  const provider = (params.get(OAUTH_PROVIDER_PARAM) ||
    'google') as OAuthProvider

  try {
    await wallet.auth({ type: 'oauth', provider })

    const [session, eoaAccount] = await Promise.all([
      wallet.getSession(),
      wallet.toAccount(),
    ])

    store.getState().setEoaAccount(eoaAccount)
    store.getState().setSession(session || null)

    // Clean up URL params
    params.delete(OAUTH_SUCCESS_PARAM)
    params.delete(OAUTH_PROVIDER_PARAM)
    const newUrl = params.toString()
      ? `${window.location.pathname}?${params.toString()}`
      : window.location.pathname
    window.history.replaceState({}, '', newUrl)

    console.log('OAuth authentication completed')
    return true
  } catch (error) {
    console.error('OAuth authentication failed:', error)
    return false
  }
}

export type ZeroDevWalletConnectorParams = {
  projectId: string
  organizationId?: string
  proxyBaseUrl?: string
  aaUrl?: string // Bundler/paymaster URL
  chains: readonly Chain[]
  rpId?: string
  sessionStorage?: StorageAdapter
  autoRefreshSession?: boolean
  sessionWarningThreshold?: number
}

export function zeroDevWallet(
  params: ZeroDevWalletConnectorParams,
): CreateConnectorFn {
  type Provider = ReturnType<typeof createProvider>
  type Properties = {
    connect<withCapabilities extends boolean = false>(parameters?: {
      chainId?: number | undefined
      isReconnecting?: boolean | undefined
      withCapabilities?: withCapabilities | boolean | undefined
    }): Promise<{
      accounts: withCapabilities extends true
        ? readonly {
            address: `0x${string}`
            capabilities: Record<string, unknown>
          }[]
        : readonly `0x${string}`[]
      chainId: number
    }>
    getStore(): Promise<ReturnType<typeof createZeroDevWalletStore>>
  }

  return createConnector<Provider, Properties>((wagmiConfig) => {
    let store: ReturnType<typeof createZeroDevWalletStore>
    let provider: ReturnType<typeof createProvider>

    // Get transports from Wagmi config (uses user's RPC URLs)
    const transports = wagmiConfig.transports

    // Lazy initialization - only runs on client side
    const initialize = async () => {
      console.log('Initializing ZeroDevWallet connector...')

      // Initialize wallet SDK
      const wallet = await createZeroDevWallet({
        projectId: params.projectId,
        ...(params.organizationId && {
          organizationId: params.organizationId,
        }),
        ...(params.proxyBaseUrl && { proxyBaseUrl: params.proxyBaseUrl }),
        ...(params.sessionStorage && {
          sessionStorage: params.sessionStorage,
        }),
        ...(params.rpId && { rpId: params.rpId }),
      })

      // Create store
      store = createZeroDevWalletStore()
      store.getState().setWallet(wallet)

      // Store OAuth config - uses proxyBaseUrl and projectId from params
      store.getState().setOAuthConfig({
        backendUrl: params.proxyBaseUrl || `${KMS_SERVER_URL}/api/v1`,
        projectId: params.projectId,
      })

      // Create EIP-1193 provider
      provider = createProvider({
        store,
        config: params,
        chains: Array.from(params.chains),
      })

      // Check for existing session (page reload)
      const session = await wallet.getSession()
      if (session) {
        console.log('Found existing session, restoring...')
        const eoaAccount = await wallet.toAccount()
        store.getState().setEoaAccount(eoaAccount)
        store.getState().setSession(session)
      }

      // Auto-detect OAuth callback (when popup redirects back with ?oauth_success=true)
      await detectAndHandleOAuthCallback(wallet, store)

      console.log('ZeroDevWallet connector initialized')
    }

    return {
      id: 'zerodev-wallet',
      name: 'ZeroDevWallet',
      type: 'injected' as const,

      async setup() {
        // Initialize on client-side mount (setup only runs client-side)
        if (typeof window !== 'undefined') {
          await initialize()
        }
      },

      async connect({ chainId, ...rest } = {}) {
        const withCapabilities =
          ('withCapabilities' in rest && rest.withCapabilities) || false
        const isReconnecting =
          ('isReconnecting' in rest && rest.isReconnecting) || false

        // Ensure wallet is initialized (lazy init on first connect)
        await initialize()

        console.log(
          isReconnecting
            ? 'Reconnecting ZeroDevWallet...'
            : 'Connecting ZeroDevWallet...',
        )
        const state = store.getState()

        // Determine active chain
        const activeChainId =
          chainId ?? state.activeChainId ?? params.chains[0].id

        // If reconnecting and already have kernel account, return immediately
        if (isReconnecting && state.kernelAccounts.has(activeChainId)) {
          const kernelAccount = state.kernelAccounts.get(activeChainId)
          if (kernelAccount?.address) {
            console.log('Already connected:', kernelAccount.address)
            return {
              accounts: [kernelAccount.address] as never,
              chainId: activeChainId,
            }
          }
        }

        if (!state.eoaAccount) {
          throw new Error(
            'Not authenticated. Please authenticate first using passkey, OAuth, or OTP.',
          )
        }

        // Create KernelAccount for this chain if doesn't exist
        if (!state.kernelAccounts.has(activeChainId)) {
          const chain = params.chains.find((c) => c.id === activeChainId)
          if (!chain) {
            throw new Error(`Chain ${activeChainId} not found in config`)
          }

          // Use transport from Wagmi config (has user's RPC URL)
          const transport = transports?.[activeChainId] ?? http()
          const publicClient = createPublicClient({
            chain,
            transport,
          })

          console.log(`Creating kernel account for chain ${activeChainId}...`)
          const kernelAccount = await createKernelAccount(publicClient, {
            entryPoint: getEntryPoint('0.7'),
            kernelVersion: KERNEL_V3_3,
            eip7702Account: state.eoaAccount,
          })

          // Store kernel account for this chain
          store.getState().setKernelAccount(activeChainId, kernelAccount)

          // Create and store kernel client for transactions
          const kernelClient = createKernelAccountClient({
            account: kernelAccount,
            bundlerTransport: http(
              getAAUrl(params.projectId, activeChainId, params.aaUrl),
            ),
            chain,
            client: publicClient,
            paymaster: createZeroDevPaymasterClient({
              chain,
              transport: http(
                getAAUrl(params.projectId, activeChainId, params.aaUrl),
              ),
            }),
          })
          store.getState().setKernelClient(activeChainId, kernelClient)
        }

        // Set as active chain
        store.getState().setActiveChainId(activeChainId)

        // Get fresh state after updates
        const freshState = store.getState()
        const kernelAccount = freshState.kernelAccounts.get(activeChainId)!

        console.log('ZeroDevWallet connected:', kernelAccount.address)

        const address = kernelAccount.address
        return {
          accounts: (withCapabilities
            ? [{ address, capabilities: {} }]
            : [address]) as never,
          chainId: activeChainId,
        }
      },

      async disconnect() {
        console.log('Disconnecting ZeroDevWallet...')
        if (!store) return
        const wallet = store.getState().wallet

        // Cleanup provider (clears timers)
        provider?.destroy()

        await wallet?.logout()
        store.getState().clear()
      },

      async getAccounts() {
        if (!store) return []
        const { eoaAccount, kernelAccounts, activeChainId } = store.getState()

        // Return EOA address if we have it (EIP-7702: EOA address = kernel address)
        if (eoaAccount) {
          return [eoaAccount.address]
        }

        // Fallback: check kernel accounts
        const activeAccount = activeChainId
          ? kernelAccounts.get(activeChainId)
          : null
        return activeAccount ? [activeAccount.address] : []
      },

      async getChainId() {
        if (!store) return params.chains[0].id
        return store.getState().activeChainId ?? params.chains[0].id
      },

      async getProvider() {
        if (!provider) {
          await initialize()
        }
        return provider
      },

      async switchChain({ chainId }) {
        console.log(`Switching to chain ${chainId}...`)
        const state = store.getState()

        if (!state.eoaAccount) {
          throw new Error('Not authenticated')
        }

        // Update active chain
        store.getState().setActiveChainId(chainId)

        // Create kernel account for new chain if doesn't exist
        if (!state.kernelAccounts.has(chainId)) {
          const chain = params.chains.find((c) => c.id === chainId)
          if (!chain) {
            throw new Error(`Chain ${chainId} not found in config`)
          }

          // Use transport from Wagmi config (has user's RPC URL)
          const transport = transports?.[chainId] ?? http()
          const publicClient = createPublicClient({
            chain,
            transport,
          })

          console.log(`Creating kernel account for chain ${chainId}...`)
          const kernelAccount = await createKernelAccount(publicClient, {
            entryPoint: getEntryPoint('0.7'),
            kernelVersion: KERNEL_V3_3,
            eip7702Account: state.eoaAccount,
          })

          store.getState().setKernelAccount(chainId, kernelAccount)
          const kernelClient = createKernelAccountClient({
            account: kernelAccount,
            bundlerTransport: http(
              getAAUrl(params.projectId, chainId, params.aaUrl),
            ),
            chain,
            client: publicClient,
            paymaster: createZeroDevPaymasterClient({
              chain,
              transport: http(
                getAAUrl(params.projectId, chainId, params.aaUrl),
              ),
            }),
          })
          store.getState().setKernelClient(chainId, kernelClient)
        }

        wagmiConfig.emitter.emit('change', { chainId })
        return params.chains.find((c) => c.id === chainId)!
      },

      async isAuthorized() {
        // Just check if we have a session - don't initialize here (too slow)
        if (!store) return false
        return !!store.getState().eoaAccount
      },

      // Custom method for hooks to access store
      async getStore() {
        await initialize()
        return store
      },

      // Event listeners
      onAccountsChanged() {
        // Not applicable for this wallet type
      },
      onChainChanged() {
        // Handled by Wagmi
      },
      onConnect() {
        // Handled by Wagmi
      },
      onDisconnect() {
        console.log('Disconnect event')
        provider?.destroy()
        store.getState().clear()
      },
    }
  })
}
