import type { KernelSmartAccountImplementation } from '@zerodev/sdk'
import { normalizeTimestamp } from '@zerodev/wallet-core'
import { Provider } from 'ox'
import type { Chain, LocalAccount } from 'viem'
import type { SmartAccount } from 'viem/account-abstraction'
import type { ConnectorCoreParams, WalletMode } from './core/connector.js'
import { NotAuthenticatedError } from './errors.js'
import type { createZeroDevWalletStore } from './store.js'

const SESSION_WARNING_THRESHOLD_MS = 60 * 1000 // 1 minute before expiry

type Signer = SmartAccount<KernelSmartAccountImplementation> | LocalAccount

type WalletCall = {
  to?: `0x${string}`
  value?: `0x${string}`
  data?: `0x${string}`
}

/**
 * Pick the right signer for `personal_sign` / `eth_signTypedData_v4`.
 *
 * - `'EOA'`: always the raw EOA.
 * - `'7702'`: prefer the kernel, but fall back to the EOA when the kernel
 *   isn't deployed yet. This is safe in 7702 because the EOA address equals
 *   the kernel address, so dapps verify the signature against the same
 *   `0x…` regardless of delegation state.
 * - `'4337'`: always use the kernel account. The kernel address differs
 *   from the EOA, so a raw EOA signature would never validate against it.
 *   When the kernel isn't deployed yet, `@zerodev/sdk` wraps the signature
 *   in ERC-6492 so dapps can verify against the counterfactual address.
 */
async function signerForActiveChain(
  state: ReturnType<ReturnType<typeof createZeroDevWalletStore>['getState']>,
  activeChainId: number,
  mode: WalletMode,
): Promise<Signer | null> {
  if (mode === 'EOA') return state.eoaAccount

  const kernelAccount = state.kernelAccounts.get(activeChainId)
  if (mode === '4337') return kernelAccount ?? null

  // 7702: EOA-vs-kernel pre-deployment doesn't matter for verification.
  if (
    kernelAccount &&
    'isDeployed' in kernelAccount &&
    !(await kernelAccount.isDeployed())
  ) {
    return state.eoaAccount
  }
  return kernelAccount ?? state.eoaAccount ?? null
}

type CreateProviderParams = {
  store: ReturnType<typeof createZeroDevWalletStore>
  config: ConnectorCoreParams
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
  // Mirrors the default in `connector.ts` — keep these in sync.
  const mode: WalletMode = config.mode ?? '7702'
  const emitter = Provider.createEmitter()
  let sessionRefreshTimer: ReturnType<typeof setTimeout> | null = null

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

      const accountAddressForChain = (
        chainId: number,
      ): `0x${string}` | undefined => {
        if (mode === '4337') {
          return state.kernelAccounts.get(chainId)?.address
        }
        return state.eoaAccount?.address
      }

      const validateFromAddress = (
        chainId: number,
        from?: `0x${string}`,
      ): void => {
        if (!from) return

        const expectedFrom = accountAddressForChain(chainId)
        if (!expectedFrom) return

        if (from.toLowerCase() !== expectedFrom.toLowerCase()) {
          throw new Error(
            `Invalid from address: expected ${expectedFrom}, got ${from}`,
          )
        }
      }

      switch (method) {
        case 'eth_accounts': {
          const addr = accountAddressForChain(activeChainId)
          return addr ? [addr] : []
        }

        case 'eth_requestAccounts': {
          const addr = accountAddressForChain(activeChainId)
          if (!addr) throw new NotAuthenticatedError()
          return [addr]
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
          validateFromAddress(chainId, tx.from)

          // EOA mode: send via plain RPC (no bundler, no sponsorship).
          if (mode === 'EOA') {
            const walletClient = store.getState().walletClients.get(chainId)
            if (!walletClient) {
              throw new Error(`No wallet client for chain ${chainId}`)
            }
            return await walletClient.sendTransaction({
              to: tx.to,
              ...(tx.value && { value: BigInt(tx.value) }),
              ...(tx.data && { data: tx.data }),
            })
          }

          // 4337 / 7702: route through the kernel client. The first 4337
          // tx deploys the smart account via factory; 7702 wraps in a
          // userOp signed by the EOA's delegated kernel.
          const kernelClient = store.getState().kernelClients.get(chainId)
          if (!kernelClient) {
            throw new Error(`No kernel client for chain ${chainId}`)
          }
          return await kernelClient.sendTransaction({
            calls: [
              {
                to: tx.to,
                value: tx.value ? BigInt(tx.value) : 0n,
                data: tx.data || '0x',
              },
            ],
          })
        }

        case 'wallet_sendCalls': {
          if (!params || params.length === 0) {
            throw new Error('Missing call parameters')
          }

          const [request] = params
          const chainId = request.chainId
            ? parseInt(request.chainId, 16)
            : activeChainId
          validateFromAddress(chainId, request.from)

          if (mode === 'EOA') {
            throw new Error('wallet_sendCalls is not supported in EOA mode')
          }

          if (!Array.isArray(request.calls) || request.calls.length === 0) {
            throw new Error('Missing calls')
          }

          const kernelClient = store.getState().kernelClients.get(chainId)
          if (!kernelClient) {
            throw new Error(`No kernel client for chain ${chainId}`)
          }

          // EIP-5792 is async by design: return the bundle ID immediately,
          // dapps poll wallet_getCallsStatus. The userOp hash is the ID.
          const userOpHash = await kernelClient.sendUserOperation({
            calls: request.calls.map((call: WalletCall) => ({
              ...(call.to && { to: call.to }),
              value:
                call.value && call.value !== '0x' ? BigInt(call.value) : 0n,
              data: call.data || '0x',
            })),
          })
          return { id: `${userOpHash}:${chainId}` }
        }

        case 'wallet_getCallsStatus': {
          if (!params || params.length === 0) {
            throw new Error('Missing call bundle id')
          }

          const [rawId] = params
          const [hash, encodedChainId] = rawId.split(':')
          const chainId = encodedChainId
            ? Number(encodedChainId)
            : activeChainId
          const kernelClient = store.getState().kernelClients.get(chainId)
          if (!kernelClient) {
            throw new Error(`No kernel client for chain ${chainId}`)
          }

          const receipt = await kernelClient
            .getUserOperationReceipt({ hash })
            .catch(() => null)
          if (!receipt) {
            return { version: '2.0.0', atomic: true, status: 100, receipts: [] }
          }

          // viem's getCallsStatus decoder expects RPC-hex receipts (it runs
          // hexToBigInt on blockNumber/gasUsed), but the bundler client
          // returns parsed bigint fields — re-encode them.
          const r = receipt.receipt
          return {
            version: '2.0.0',
            atomic: true,
            chainId: `0x${chainId.toString(16)}`,
            status: receipt.success ? 200 : 500,
            receipts: [
              {
                transactionHash: r.transactionHash,
                blockHash: r.blockHash,
                blockNumber: `0x${r.blockNumber.toString(16)}`,
                gasUsed: `0x${r.gasUsed.toString(16)}`,
                status: r.status === 'success' ? '0x1' : '0x0',
                // receipt.logs is scoped to this userOp — r.logs would leak
                // logs from other userOps bundled into the same transaction.
                logs: receipt.logs.map((log) => ({
                  address: log.address,
                  topics: log.topics,
                  data: log.data,
                })),
              },
            ],
          }
        }

        case 'wallet_getCapabilities': {
          const [, requestedChainIds] = params || []
          const chains: string[] = requestedChainIds ?? [
            `0x${activeChainId.toString(16)}`,
          ]
          // Sponsorship is project-level (dashboard policies / Ultra Relay),
          // so we intentionally do not declare or honor dapp-supplied
          // paymasterService.
          const atomic =
            mode === 'EOA' ? { status: 'unsupported' } : { status: 'supported' }
          return Object.fromEntries(chains.map((cid) => [cid, { atomic }]))
        }

        case 'personal_sign': {
          if (!params || params.length < 2) {
            throw new Error('Missing sign parameters')
          }

          const [message] = params
          const account = await signerForActiveChain(state, activeChainId, mode)
          if (!account) throw new NotAuthenticatedError()

          return await account.signMessage({
            message: { raw: message as `0x${string}` },
          })
        }

        case 'eth_signTypedData_v4': {
          if (!params || params.length < 2) {
            throw new Error('Missing typed data parameters')
          }

          const [, typedDataJson] = params
          const account = await signerForActiveChain(state, activeChainId, mode)
          if (!account) throw new NotAuthenticatedError()

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
