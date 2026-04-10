import type { StateCreator } from 'zustand'
import type { AuthConfig, AuthMethod, AuthStep } from './types'

export interface AuthStoreSlice {
  auth: {
    // State
    step: AuthStep
    stepHistory: AuthStep[]
    enabledMethods: AuthMethod[]
    email: string | null
    setEmail: (email: string) => void
    otpId: string | null
    setOtpId: (otpId: string) => void
    config: AuthConfig | null

    // Actions
    initialize: (config: AuthConfig) => void
    goToStep: (step: AuthStep) => void
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
    otpId: null,
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

    goToStep: (step: AuthStep) => {
      set((state) => ({
        auth: {
          ...state.auth,
          step,
          stepHistory: [...state.auth.stepHistory, state.auth.step],
        },
      }))
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
          otpId: null,
        },
      }))
    },

    setEmail: (email) => {
      set((state) => ({
        auth: {
          ...state.auth,
          email,
        },
      }))
    },

    setOtpId: (otpId) => {
      set((state) => ({
        auth: {
          ...state.auth,
          otpId,
        },
      }))
    },
  },
})
