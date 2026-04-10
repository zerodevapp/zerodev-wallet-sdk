import type { StateCreator } from 'zustand'
import type { AuthConfig, AuthMethod, AuthStep } from './types'

export type StepAction =
  | { step: 'initializing' }
  | { step: 'select-method' }
  | { step: 'email-input' }
  | { step: 'email-verification'; email: string }
  | { step: 'otp-input' }
  | { step: 'verifying-otp' }
  | { step: 'passkey-prompt' }
  | { step: 'oauth-in-progress' }
  | { step: 'wallet-selection' }
  | { step: 'authenticated' }
  | { step: 'error' }

export interface AuthStoreSlice {
  auth: {
    // State
    step: AuthStep
    stepHistory: AuthStep[]
    enabledMethods: AuthMethod[]
    email: string | null
    config: AuthConfig | null

    // Actions
    initialize: (config: AuthConfig) => void
    goToStep: (action: StepAction) => void
    selectMethod: (method: AuthMethod) => void
    goBack: () => void
    reset: () => void
  }
}

export const createAuthStoreSlice: StateCreator<
  AuthStoreSlice,
  [],
  [],
  AuthStoreSlice
> = (set, get, _store) => ({
  auth: {
    // Initial state
    step: 'initializing',
    stepHistory: [],
    enabledMethods: [],
    email: null,
    config: null,

    // Actions
    initialize: (config: AuthConfig) => {
      set((state) => ({
        auth: {
          ...state.auth,
          config,
          enabledMethods: config.enabledMethods,
          step: 'select-method',
        },
      }))
    },

    goToStep: (action: StepAction) => {
      const { auth } = get()
      set((state) => ({
        auth: {
          ...state.auth,
          step: action.step,
          stepHistory: [...state.auth.stepHistory, auth.step],
          // Merge any additional data from the action (like email)
          ...('email' in action && { email: action.email }),
        },
      }))
    },

    selectMethod: (method: AuthMethod) => {
      const { auth } = get()

      switch (method) {
        case 'email':
          set((state) => ({
            auth: {
              ...state.auth,
              step: 'email-input',
              stepHistory: [...state.auth.stepHistory, auth.step],
            },
          }))
          break
        case 'passkey':
          set((state) => ({
            auth: {
              ...state.auth,
              step: 'passkey-prompt',
              stepHistory: [...state.auth.stepHistory, auth.step],
            },
          }))
          break
        case 'google':
          set((state) => ({
            auth: {
              ...state.auth,
              step: 'oauth-in-progress',
              stepHistory: [...state.auth.stepHistory, auth.step],
            },
          }))
          break
        case 'injected-wallet':
          set((state) => ({
            auth: {
              ...state.auth,
              step: 'wallet-selection',
              stepHistory: [...state.auth.stepHistory, auth.step],
            },
          }))
          break
      }
    },

    goBack: () => {
      const { auth } = get()
      const newHistory = [...auth.stepHistory]
      const previousStep = newHistory.pop() ?? 'select-method'
      set((state) => ({
        auth: {
          ...state.auth,
          step: previousStep,
          stepHistory: newHistory,
        },
      }))
    },

    reset: () => {
      set((state) => ({
        auth: {
          ...state.auth,
          step: 'initializing',
          stepHistory: [],
          email: null,
        },
      }))
    },
  },
})
