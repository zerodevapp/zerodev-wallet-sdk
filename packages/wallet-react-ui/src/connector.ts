import type { CreateConnectorFn } from '@wagmi/core'
import type {
  ZeroDevProvider,
  ZeroDevWalletConnectorParams,
} from '@zerodev/wallet-react'
import {
  zeroDevWallet as baseZeroDevWallet,
  NotAuthenticatedError,
} from '@zerodev/wallet-react'
import { createStore } from './store.js'
import type { Request, RequestMethod } from './types.js'

const DEFAULT_SIGNING_PROMPT_METHODS: RequestMethod[] = [
  'eth_sendTransaction',
  'wallet_sendTransaction',
  'wallet_sendCalls',
  'personal_sign',
  'eth_signTypedData_v4',
]

/** The kit connector takes exactly the base connector's param
 We alias it to leave room for expansion */
export type ZeroDevKitConnectorParams = ZeroDevWalletConnectorParams

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
          if (
            connectParams?.isReconnecting ||
            !(error instanceof NotAuthenticatedError)
          ) {
            throw error
          }

          if (store.getState().auth.step !== null) {
            throw new Error('Auth flow already in progress')
          }

          store.getState().auth.goToStep('sign-up')
          await waitForAuthFlow(store)
          return connector.connect(connectParams)
        }
      },

      async disconnect() {
        await connector.disconnect?.()
        store.getState().auth.reset()
      },

      async setup() {
        // Restore a persisted OTP session BEFORE base setup so an email flow
        // survives a reload. The restore is a synchronous localStorage read;
        // base setup does async work (wallet creation, session validation)
        // that can be slow or fail. Magic-link verification races on this —
        // `Verifying` reads the session once on mount, and gating the restore
        // behind base setup made it see an empty session and strip the code
        // from the URL. Restoring first runs synchronously inside wagmi's
        // createConfig, before any React effect can observe the store.
        if (typeof window !== 'undefined') {
          store.getState().auth.initialize()
        }

        await connector.setup?.()

        // Everything below is browser-only. Skip during SSR — getProvider()
        // touches `window` for EIP-6963 discovery and would crash on the
        // server.
        if (typeof window === 'undefined') return

        // Signing is pinned to background mode: the prompt-mode confirmation UI
        // is not part of this package's public surface, so requests always pass
        // through without gating. The wrapping logic below is retained but
        // unreachable.
        // const signing = params.signing
        const signing = { mode: 'background' } as const
        if (signing.mode === 'background') return

        const methods =
          // (signing?.mode === 'prompt' && signing.methods) ||
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
