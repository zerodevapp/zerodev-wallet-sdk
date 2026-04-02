import type { KernelSmartAccountImplementation } from '@zerodev/sdk'
import { normalizeTimestamp } from '@zerodev/wallet-core'
import { Provider } from 'ox'
import type { Chain, LocalAccount } from 'viem'
import type { SmartAccount } from 'viem/account-abstraction'
import type { ZeroDevWalletConnectorParams } from './connector.js'
import type { createZeroDevWalletStore } from './store.js'

const SESSION_WARNING_THRESHOLD_MS = 60 * 1000 // 1 minute before expiry

type CreateProviderParams = {
  store: ReturnType<typeof createZeroDevWalletStore>
  config: ZeroDevWalletConnectorParams
  chains: Chain[]
}

export type ZeroDevProvider = ReturnType<typeof Provider.createEmitter> & {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>
  destroy(): void
}

export function createProvider({
  store,
  config,
}: CreateProviderParams): ZeroDevProvider {
  const emitter = Provider.createEmitter()
  let sessionRefreshTimer: NodeJS.Timeout | null = null

  // Session auto-refresh logic
  const scheduleSessionRefresh = () => {
    if (config.autoRefreshSession === false) return

    const state = store.getState()
    if (!state.session || !state.wallet) return

    const expiryMs = normalizeTimestamp(state.session.expiry)
    const now = Date.now()
    const timeUntilExpiry = expiryMs - now

    if (timeUntilExpiry <= 0) {
      console.log('Session already expired')
      return
    }

    // Clear existing timer
    if (sessionRefreshTimer) {
      clearTimeout(sessionRefreshTimer)
      sessionRefreshTimer = null
    }

    const threshold =
      config.sessionWarningThreshold || SESSION_WARNING_THRESHOLD_MS
    const refreshAt = expiryMs - threshold
    const timeUntilRefresh = refreshAt - now

    if (timeUntilRefresh <= 0) {
      console.log('Session expiring soon, refreshing immediately...')
      refreshSessionNow()
    } else {
      console.log(`Scheduling session refresh in ${timeUntilRefresh}ms`)
      sessionRefreshTimer = setTimeout(() => {
        refreshSessionNow()
      }, timeUntilRefresh)
    }
  }

  const refreshSessionNow = async () => {
    const state = store.getState()
    if (!state.wallet || !state.session) return

    console.log('Auto-refreshing session...')
    store.getState().setIsExpiring(true)

    try {
      const newSession = await state.wallet.refreshSession(state.session.id)
      console.log('Session refreshed successfully')
      store.getState().setSession(newSession || null)
      store.getState().setIsExpiring(false)

      if (newSession) {
        scheduleSessionRefresh()
      }
    } catch (err) {
      console.error('Session refresh failed:', err)
      store.getState().setIsExpiring(false)
      store.getState().clear()
    }
  }

  // Subscribe to session changes
  const unsubscribe = store.subscribe(
    (state) => state.session,
    () => {
      scheduleSessionRefresh()
    },
  )

  // Schedule initial refresh if session exists
  const initialSession = store.getState().session
  if (initialSession) {
    scheduleSessionRefresh()
  }

  return {
    ...emitter,

    destroy() {
      // Cleanup timer and subscription
      if (sessionRefreshTimer) {
        clearTimeout(sessionRefreshTimer)
        sessionRefreshTimer = null
      }
      unsubscribe()
    },

    async request({ method, params }: { method: string; params?: any[] }) {
      const state = store.getState()
      const activeChainId = state.activeChainId
      if (!activeChainId) {
        throw new Error('No active chain')
      }

      switch (method) {
        case 'eth_accounts': {
          const account = state.kernelAccounts.get(activeChainId)
          return account ? [account.address] : []
        }

        case 'eth_requestAccounts': {
          const account = state.kernelAccounts.get(activeChainId)
          if (!account) throw new Error('Not authenticated')
          return [account.address]
        }

        case 'eth_chainId': {
          return `0x${activeChainId.toString(16)}`
        }

        case 'wallet_sendTransaction':
        case 'eth_sendTransaction': {
          if (!params || params.length === 0) {
            throw new Error('Missing transaction parameters')
          }

          const [tx] = params
          const chainId = tx.chainId ? parseInt(tx.chainId, 16) : activeChainId

          // Get kernel client for this chain
          const kernelClient = store.getState().kernelClients.get(chainId)
          if (!kernelClient) {
            throw new Error(`No kernel client for chain ${chainId}`)
          }

          // Transactions are sent as UserOperations under the hood (EIP-7702).
          // Gasless if a paymaster is configured on the ZeroDev dashboard.
          const hash = await kernelClient.sendTransaction({
            calls: [
              {
                to: tx.to,
                value: tx.value ? BigInt(tx.value) : 0n,
                data: tx.data || '0x',
              },
            ],
          })

          return hash
        }

        case 'personal_sign': {
          if (!params || params.length < 2) {
            throw new Error('Missing sign parameters')
          }

          const [message] = params
          let account:
            | SmartAccount<KernelSmartAccountImplementation>
            | LocalAccount
            | undefined
            | null = state.kernelAccounts.get(activeChainId)
          if (
            account &&
            'isDeployed' in account &&
            !(await account.isDeployed())
          ) {
            account = state.eoaAccount
          }

          if (!account) throw new Error('Not authenticated')

          return await account.signMessage({
            message: { raw: message as `0x${string}` },
          })
        }

        case 'eth_signTypedData_v4': {
          if (!params || params.length < 2) {
            throw new Error('Missing typed data parameters')
          }

          const [, typedDataJson] = params
          let account:
            | SmartAccount<KernelSmartAccountImplementation>
            | LocalAccount
            | undefined
            | null = state.kernelAccounts.get(activeChainId)
          if (
            account &&
            'isDeployed' in account &&
            !(await account.isDeployed())
          ) {
            account = state.eoaAccount
          }
          if (!account) throw new Error('Not authenticated')

          const typedData = JSON.parse(typedDataJson)
          return await account.signTypedData(typedData)
        }

        case 'wallet_switchEthereumChain': {
          if (!params || params.length === 0) {
            throw new Error('Missing chain parameter')
          }

          const [{ chainId }] = params
          const chainId_number = parseInt(chainId, 16)

          // Update active chain
          store.getState().setActiveChainId(chainId_number)

          // Emit chainChanged event
          emitter.emit('chainChanged', chainId)

          return null
        }

        default:
          throw new Error(`Method not supported: ${method}`)
      }
    },
  }
}
