import type { CreateConnectorFn } from '@wagmi/core'
import type {
  ZeroDevProvider,
  ZeroDevWalletConnectorParams,
} from '@zerodev/wallet-react'
import { zeroDevWallet } from '@zerodev/wallet-react'
import { createStore } from './store.js'
import type { Request, RequestMethod } from './types.js'

const DEFAULT_SIGNING_PROMPT_METHODS: RequestMethod[] = [
  'eth_sendTransaction',
  'wallet_sendTransaction',
  'personal_sign',
  'eth_signTypedData_v4',
]

export type SigningConfig =
  | { mode: 'background' }
  | { mode: 'prompt'; methods?: RequestMethod[] }

export type ZeroDevKitConfig = {
  signing?: SigningConfig
}

export type ZeroDevKitConnectorParams = ZeroDevWalletConnectorParams & {
  config?: ZeroDevKitConfig
}

function requireUserConfirmation(
  store: ReturnType<typeof createStore>,
  request: Request,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    store.getState().setPendingRequest({
      id: crypto.randomUUID(),
      ...request,
      resolve,
      reject,
    })
  })
}

export function zeroDevKitWallet(
  params: ZeroDevKitConnectorParams,
): CreateConnectorFn {
  const baseFactory = zeroDevWallet(params)
  const store = createStore()

  return (wagmiConfig) => {
    const connector = baseFactory(wagmiConfig)

    return {
      ...connector,

      async setup() {
        await connector.setup?.()

        const signing = params.config?.signing
        if (signing?.mode === 'background') return

        const methods =
          (signing?.mode === 'prompt' && signing.methods) ||
          DEFAULT_SIGNING_PROMPT_METHODS

        const provider = (await connector.getProvider()) as ZeroDevProvider
        const baseRequest = provider.request.bind(provider)

        // todo: move Request type to core package and use as the method and params type here
        // then we can remove as RequestMethod and spread in return baseRequest
        provider.request = async ({
          method,
          params: reqParams,
        }: {
          method: string
          params?: unknown[]
        }) => {
          const { userConfirmationListenerActive } = store.getState()
          if (
            userConfirmationListenerActive &&
            methods.includes(method as RequestMethod)
          ) {
            await requireUserConfirmation(store, {
              method: method as RequestMethod,
              params: reqParams,
            } as Request)
          }

          return baseRequest({
            method,
            ...(reqParams && { params: reqParams }),
          })
        }
      },

      getKitStore() {
        return store
      },
    }
  }
}
