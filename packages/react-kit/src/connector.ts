import type { CreateConnectorFn } from '@wagmi/core'
import type {
  ZeroDevProvider,
  ZeroDevWalletConnectorParams,
} from '@zerodev/wallet-react'
import {
  zeroDevWallet as baseZeroDevWallet,
  NotAuthenticatedError,
} from '@zerodev/wallet-react'
import type { AuthConfig } from './auth/types'
import { createStore } from './store.js'
import type { Request, RequestMethod } from './types.js'

const DEFAULT_SIGNING_PROMPT_METHODS: RequestMethod[] = [
  'eth_sendTransaction',
  'wallet_sendTransaction',
  'wallet_sendCalls',
  'personal_sign',
  'eth_signTypedData_v4',
]

export type SigningConfig =
  | { mode: 'background' }
  | { mode: 'prompt'; methods?: RequestMethod[] }

export type ZeroDevKitConfig = {
  signing?: SigningConfig
  auth?: AuthConfig
}

export type ZeroDevKitConnectorParams = ZeroDevWalletConnectorParams & {
  config?: ZeroDevKitConfig
}

function requireUserConfirmation(
  store: ReturnType<typeof createStore>,
  request: Request,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    store.getState().addPendingRequest({
      id: crypto.randomUUID(),
      ...request,
      resolve,
      reject,
    })
  })
}

/**
 * Resolves when the user completes the auth flow (`step === 'authenticated'`),
 * rejects when they dismiss it (`step === null`).
 */
function waitForAuthFlow(store: ReturnType<typeof createStore>): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const unsub = store.subscribe(
      (state) => state.auth.step,
      (step) => {
        if (step === 'authenticated') {
          unsub()
          resolve()
        } else if (step === null) {
          // User dismissed the auth flow (e.g. clicked the TopNav close
          // button) — abort the pending wagmi connect.
          unsub()
          reject(new Error('Auth flow dismissed'))
        }
      },
    )
  })
}

export function zeroDevWallet(
  params: ZeroDevKitConnectorParams,
): CreateConnectorFn {
  const baseFactory = baseZeroDevWallet(params)
  const store = createStore()

  // Initialize auth config if provided
  if (params.config?.auth) {
    store.getState().auth.initialize(params.config.auth)
  }

  return (wagmiConfig) => {
    const connector = baseFactory(wagmiConfig)

    return {
      ...connector,

      async connect(connectParams) {
        // Try to connect first. If a session is persisted, base will load it
        // and resolve — no auth UI needed. If not, it throws
        // `NotAuthenticatedError` and we surface SignUp.
        //
        // This avoids forcing every connect to await the base store's init
        // (which `isAuthorized()` deliberately skips for perf — see
        // packages/react/src/core/connector.ts), and avoids flashing the auth
        // UI on first paint when the session hasn't loaded yet.
        try {
          return await connector.connect(connectParams)
        } catch (error) {
          // wagmi sets `isReconnecting` on reconnectOnMount; a silent
          // reconnect failure must not pop the auth UI.
          const isReconnecting =
            !!connectParams && connectParams.isReconnecting === true

          if (
            isReconnecting ||
            !params.config?.auth ||
            store.getState().auth.step !== null ||
            !(error instanceof NotAuthenticatedError)
          ) {
            throw error
          }

          store.getState().auth.goToStep('sign-up')
          await waitForAuthFlow(store)
          return connector.connect(connectParams)
        }
      },

      async disconnect() {
        await connector.disconnect?.()
        if (params.config?.auth) {
          store.getState().auth.reset()
        }
      },

      async setup() {
        await connector.setup?.()

        // Request-wrapping is only meaningful in the browser (it gates calls
        // on UI confirmation). Skip during SSR — getProvider() touches
        // `window` for EIP-6963 discovery and would crash on the server.
        if (typeof window === 'undefined') return

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
