import { type CreateConnectorFn, createConnector } from '@wagmi/core'
import { signerToEcdsaValidator } from '@zerodev/ecdsa-validator'
import {
  createKernelAccount,
  createKernelAccountClient,
  createZeroDevPaymasterClient,
} from '@zerodev/sdk'
import { getEntryPoint, KERNEL_V3_3 } from '@zerodev/sdk/constants'
import type {
  ApiKeyStamper,
  CreateTransportOptions,
  PasskeyStamper,
  StorageAdapter,
} from '@zerodev/wallet-core'
import { createZeroDevWallet, KMS_SERVER_URL } from '@zerodev/wallet-core'
import { type Chain, createPublicClient, createWalletClient, http } from 'viem'
import { NotAuthenticatedError } from '../errors.js'
import { createProvider } from '../provider.js'
import { type CreateStoreOptions, createZeroDevWalletStore } from '../store.js'
import { getAAUrl } from '../utils/aaUtils.js'
import { isReactNative } from '../utils/platform.js'

/**
 * Account mode the connector exposes to wagmi.
 *
 * - `'7702'` (default): EOA delegated to a Kernel smart account via EIP-7702.
 *   Address equals the EOA address; transactions are bundled as UserOperations
 *   and can be sponsored.
 * - `'4337'`: Counterfactual ERC-4337 Kernel smart account. Address differs
 *   from the EOA; the account is deployed on first userOp. Transactions are
 *   bundled as UserOperations.
 * - `'EOA'`: Plain EOA. Transactions are sent directly via the chain's RPC
 *   (no bundler, no sponsorship). The EOA address is exposed to wagmi.
 */
export type WalletMode = 'EOA' | '4337' | '7702'

export type ConnectorCoreParams = {
  projectId: string
  organizationId?: string
  proxyBaseUrl?: string
  aaHost?: string // Bundler/paymaster host origin (default: ZERODEV_AA_HOST)
  chains: readonly Chain[]
  rpId?: string
  sessionStorage?: StorageAdapter
  persistStorage?: CreateStoreOptions['storage']
  apiKeyStamper?: ApiKeyStamper | Promise<ApiKeyStamper>
  passkeyStamper?: PasskeyStamper | Promise<PasskeyStamper>
  /**
   * Forwarded to BOTH the Turnkey transport (via createZeroDevWallet) and
   * the AA bundler/paymaster HTTP transports. On RN, the native wrapper
   * derives this from `rpId` so both backends receive the matching `Origin`
   * header. Web consumers don't need it (browsers ignore Origin overrides).
   */
  fetchOptions?: CreateTransportOptions['fetchOptions']
  autoRefreshSession?: boolean
  sessionWarningThreshold?: number
  /**
   * Wallet mode. Defaults to `'7702'` for backward compatibility — change
   * to `'4337'` for a counterfactual smart account, or `'EOA'` for a plain
   * EOA without account abstraction.
   */
  mode?: WalletMode
  /**
   * Per-chain overrides for local / self-hosted AA infrastructure. When an
   * entry exists for a chain, the kernel client uses `bundlerUrl` directly as
   * its bundler transport (bypassing the hosted ZeroDev AA URL), and — when
   * `selfFunded` is set — omits the paymaster so the account pays its own gas.
   * Intended for local dev against Anvil + a locally-run bundler (e.g. Ultra
   * Relay), where there is no hosted bundler/paymaster.
   */
  aaOverrides?: Record<number, { bundlerUrl: string; selfFunded?: boolean }>
  // Controls whether setup() automatically initializes the connector on mount.
  // When false, the connector still initializes lazily on connect/getProvider/getStore.
  autoInitialize?: boolean | (() => boolean)
}

export function zeroDevWalletCore(
  params: ConnectorCoreParams,
): CreateConnectorFn {
  type Provider = ReturnType<typeof createProvider>
  type Properties = {
    rpId: string | undefined
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

  // Defaults to '7702' so existing consumers get the same behavior as before
  // this option was added.
  const mode: WalletMode = params.mode ?? '7702'

  return createConnector<Provider, Properties>((wagmiConfig) => {
    let store: ReturnType<typeof createZeroDevWalletStore>
    let provider: ReturnType<typeof createProvider>
    let initPromise: Promise<void> | null = null

    // Get transports from Wagmi config (uses user's RPC URLs)
    const transports = wagmiConfig.transports

    /**
     * Create the per-chain client(s) needed for the configured mode.
     *
     * - `'7702'` / `'4337'`: a {@link KernelAccountClient} (bundler + paymaster).
     *   Cached in `state.kernelClients`.
     * - `'EOA'`: a viem {@link createWalletClient} bound to the chain's RPC.
     *   Cached in `state.walletClients`.
     *
     * No-ops if the chain is already set up.
     */
    const setupChain = async (
      chainId: number,
      httpOpts?: { fetchOptions?: CreateTransportOptions['fetchOptions'] },
    ) => {
      const state = store.getState()
      const eoaAccount = state.eoaAccount
      if (!eoaAccount) throw new NotAuthenticatedError()

      const chain = params.chains.find((c) => c.id === chainId)
      if (!chain) throw new Error(`Chain ${chainId} not found in config`)

      const transport = transports?.[chainId] ?? http()

      if (mode === 'EOA') {
        if (state.walletClients.has(chainId)) return
        const walletClient = createWalletClient({
          account: eoaAccount,
          chain,
          transport,
        })
        store.getState().setWalletClient(chainId, walletClient)
        return
      }

      if (state.kernelAccounts.has(chainId)) return

      const publicClient = createPublicClient({ chain, transport })

      console.log(`Creating kernel account for chain ${chainId}...`)
      // For 4337, the kernel needs an ECDSA validator plugin keyed off the
      // EOA so it can authorize userOps. 7702 uses `eip7702Account` instead
      // (the EOA itself is the validator via its delegation).
      const kernelAccount = await createKernelAccount(publicClient, {
        entryPoint: getEntryPoint('0.7'),
        kernelVersion: KERNEL_V3_3,
        ...(mode === '7702'
          ? { eip7702Account: eoaAccount }
          : {
              plugins: {
                sudo: await signerToEcdsaValidator(publicClient, {
                  signer: eoaAccount,
                  entryPoint: getEntryPoint('0.7'),
                  kernelVersion: KERNEL_V3_3,
                }),
              },
            }),
      })
      store.getState().setKernelAccount(chainId, kernelAccount)

      // Local/self-hosted override: use a bare bundler URL and (optionally)
      // skip the paymaster so the account self-funds. Falls back to the hosted
      // ZeroDev AA URL + paymaster when no override is configured for the chain.
      const aaOverride = params.aaOverrides?.[chainId]
      const bundlerUrl =
        aaOverride?.bundlerUrl ??
        getAAUrl(params.projectId, chainId, params.aaHost)

      const kernelClient = createKernelAccountClient({
        account: kernelAccount,
        bundlerTransport: http(bundlerUrl, httpOpts),
        chain,
        client: publicClient,
        ...(aaOverride?.selfFunded
          ? {}
          : {
              paymaster: createZeroDevPaymasterClient({
                chain,
                transport: http(
                  getAAUrl(params.projectId, chainId, params.aaHost),
                  httpOpts,
                ),
              }),
            }),
      })
      store.getState().setKernelClient(chainId, kernelClient)
    }

    /**
     * Address that this connector exposes to wagmi for the given chain.
     * For `'4337'` the kernel's counterfactual address differs from the EOA;
     * everywhere else the EOA address is correct.
     */
    const accountAddressForChain = (chainId: number): `0x${string}` | null => {
      const state = store.getState()
      if (mode === '4337') {
        return state.kernelAccounts.get(chainId)?.address ?? null
      }
      return state.eoaAccount?.address ?? null
    }
    const httpOpts = params.fetchOptions
      ? { fetchOptions: params.fetchOptions }
      : undefined

    // Lazy initialization - only runs on client side (idempotent)
    const initialize = async () => {
      if (initPromise) return initPromise
      initPromise = doInitialize()
      return initPromise
    }

    const doInitialize = async () => {
      console.log('Initializing ZeroDevWallet connector...')

      let apiKeyStamper: ApiKeyStamper | undefined
      let passkeyStamper: PasskeyStamper | undefined
      if (params.apiKeyStamper) {
        apiKeyStamper = await params.apiKeyStamper
      }
      if (params.passkeyStamper) {
        passkeyStamper = await params.passkeyStamper
      }

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
        ...(apiKeyStamper && { apiKeyStamper }),
        ...(passkeyStamper && { passkeyStamper }),
        ...(params.fetchOptions && { fetchOptions: params.fetchOptions }),
      })

      // Create store
      store = createZeroDevWalletStore({
        ...(params.persistStorage && { storage: params.persistStorage }),
      })

      // Wait for the store to rehydrate - if an async storage is used we need to ensure the persisted state is loaded
      await store.persist.rehydrate()

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

      console.log('ZeroDevWallet connector initialized')
    }

    return {
      id: 'zerodev-wallet',
      name: 'ZeroDevWallet',
      type: 'injected' as const,
      rpId: params.rpId,

      async setup() {
        const shouldInit =
          typeof params.autoInitialize === 'function'
            ? params.autoInitialize()
            : (params.autoInitialize ??
              (typeof window !== 'undefined' || isReactNative()))
        if (shouldInit) {
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

        // If reconnecting and the chain is already set up for this mode,
        // return immediately without recreating clients.
        const alreadySetUp =
          mode === 'EOA'
            ? state.walletClients.has(activeChainId)
            : state.kernelAccounts.has(activeChainId)
        if (isReconnecting && alreadySetUp) {
          const cached = accountAddressForChain(activeChainId)
          if (cached) {
            console.log('Already connected:', cached)
            return {
              accounts: [cached] as never,
              chainId: activeChainId,
            }
          }
        }

        if (!state.eoaAccount) {
          throw new NotAuthenticatedError(
            'Not authenticated. Please authenticate first using passkey, OAuth, or OTP.',
          )
        }

        await setupChain(activeChainId, httpOpts)

        store.getState().setActiveChainId(activeChainId)

        const address = accountAddressForChain(activeChainId)
        if (!address) throw new Error('Failed to derive account address')

        console.log('ZeroDevWallet connected:', address)
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

        // 4337: the counterfactual smart-account address differs from the
        // EOA, so we must NOT fall back to the EOA — that would briefly
        // expose the wrong address (e.g. during the reconnect race after a
        // page refresh, before `connect()` has run `setupChain`). Return []
        // until the kernel exists.
        if (mode === '4337') {
          const kernelAccount = activeChainId
            ? kernelAccounts.get(activeChainId)
            : null
          return kernelAccount ? [kernelAccount.address] : []
        }

        // 7702 and EOA modes: the wagmi-facing address is always the EOA
        // address (7702 binds the smart account to it, EOA mode is the EOA
        // directly).
        return eoaAccount ? [eoaAccount.address] : []
      },

      async getChainId() {
        if (!store) return params.chains[0].id
        return store.getState().activeChainId ?? params.chains[0].id
      },

      async getProvider() {
        await initialize()
        return provider
      },

      async switchChain({ chainId }) {
        console.log(`Switching to chain ${chainId}...`)
        const state = store.getState()

        if (!state.eoaAccount) {
          throw new NotAuthenticatedError()
        }

        store.getState().setActiveChainId(chainId)
        await setupChain(chainId, httpOpts)

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
