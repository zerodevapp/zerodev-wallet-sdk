import type { StateCreator } from 'zustand'
import type { AuthConfig, AuthMethod, AuthStep } from './types'

export interface AuthSlice {
  auth: {
    // State
    step: AuthStep
    stepHistory: AuthStep[]
    availableMethods: AuthMethod[]
    email: string | null
    otpId: string | null
    error: { message: string; recoverable: boolean } | null
    pendingMethod: AuthMethod | null
    resendAvailableAt: number | null
    config: AuthConfig | null

    // Actions
    initialize: (config: AuthConfig) => Promise<void>
    selectMethod: (method: AuthMethod) => void
    showAllMethods: () => void
    submitEmail: (email: string) => void
    submitOtp: () => void
    switchToOtpInput: () => void
    goBack: () => void
    reset: () => void
    setOtpId: (otpId: string) => void
    setResendAvailableAt: (timestamp: number) => void
    setError: (error: { message: string; recoverable: boolean } | null) => void
    setStep: (step: AuthStep) => void
  }
}

export const createAuthSlice: StateCreator<AuthSlice, [], [], AuthSlice> = (
  set,
  get,
  _store,
) => ({
  auth: {
    // Initial state
    step: 'initializing',
    stepHistory: [],
    availableMethods: [],
    email: null,
    otpId: null,
    error: null,
    pendingMethod: null,
    resendAvailableAt: null,
    config: null,

    // Actions
    initialize: async (config: AuthConfig) => {
      set((state) => ({
        auth: {
          ...state.auth,
          config,
          availableMethods: config.enabledMethods,
          step: 'select-method',
        },
      }))
    },

    selectMethod: (method: AuthMethod) => {
      const { auth } = get()
      set((state) => ({
        auth: {
          ...state.auth,
          pendingMethod: method,
        },
      }))

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

    showAllMethods: () => {
      const { auth } = get()
      set((state) => ({
        auth: {
          ...state.auth,
          step: 'all-methods',
          stepHistory: [...state.auth.stepHistory, auth.step],
        },
      }))
    },

    submitEmail: (email: string) => {
      const { auth } = get()
      set((state) => ({
        auth: {
          ...state.auth,
          email,
          step: 'email-verification',
          stepHistory: [...state.auth.stepHistory, auth.step],
        },
      }))
    },

    submitOtp: () => {
      const { auth } = get()
      set((state) => ({
        auth: {
          ...state.auth,
          step: 'verifying-otp',
          stepHistory: [...state.auth.stepHistory, auth.step],
        },
      }))
    },

    switchToOtpInput: () => {
      const { auth } = get()
      set((state) => ({
        auth: {
          ...state.auth,
          step: 'otp-input',
          stepHistory: [...state.auth.stepHistory, auth.step],
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
          error: null,
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
          error: null,
          pendingMethod: null,
          resendAvailableAt: null,
        },
      }))
    },

    setOtpId: (otpId: string) => {
      set((state) => ({
        auth: { ...state.auth, otpId },
      }))
    },

    setResendAvailableAt: (timestamp: number) => {
      set((state) => ({
        auth: { ...state.auth, resendAvailableAt: timestamp },
      }))
    },

    setError: (error: { message: string; recoverable: boolean } | null) => {
      set((state) => ({
        auth: { ...state.auth, error },
      }))
    },

    setStep: (step: AuthStep) => {
      set((state) => ({
        auth: { ...state.auth, step },
      }))
    },
  },
})
