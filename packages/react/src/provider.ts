import type { KernelSmartAccountImplementation } from '@zerodev/sdk'
import { Provider } from 'ox'
import type { Chain, LocalAccount } from 'viem'
import type { SmartAccount } from 'viem/account-abstraction'
import type { ZeroDevWalletConnectorParams } from './connector.js'
import type { createZeroDevWalletStore } from './store.js'

type CreateProviderParams = {
  store: ReturnType<typeof createZeroDevWalletStore>
  config: ZeroDevWalletConnectorParams
  chains: Chain[]
}

export type ZeroDevProvider = ReturnType<typeof Provider.createEmitter> & {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>
}

export function createProvider({
  store,
}: CreateProviderParams): ZeroDevProvider {
  const emitter = Provider.createEmitter()

  return {
    ...emitter,

    async request({ method, params }: { method: string; params?: any[] }) {
      const state = store.getState()
      const activeChainId = state.chainIds[0]

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
          console.log('eth_sendTransaction', params)
          if (!params || params.length === 0) {
            throw new Error('Missing transaction parameters')
          }

          const [tx] = params
          const chainId = tx.chainId ? parseInt(tx.chainId, 16) : activeChainId

          console.log('chainId', chainId)

          // Get kernel client for this chain
          const kernelClient = store.getState().kernelClients.get(chainId)
          if (!kernelClient) {
            throw new Error(`No kernel client for chain ${chainId}`)
          }

          console.log('kernelClient', kernelClient)

          // Send gasless transaction (always UserOp for EIP-7702)
          const hash = await kernelClient.sendTransaction({
            calls: [
              {
                to: tx.to,
                value: tx.value ? BigInt(tx.value) : 0n,
                data: tx.data || '0x',
              },
            ],
          })

          console.log('hash', hash)

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

          return await account.signMessage({ message })
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
          store.getState().setActiveChain(chainId_number)

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
