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
    /**
     * HPKE encryption target bundle returned by the latest `sendOTP` call.
     * Required by `verifyOTP` so the OTP attempt can be sealed to the enclave.
     */
    otpEncryptionTargetBundle: string | null
    /** Set both fields produced by `sendOTP` together. */
    setOtpSession: (input: {
      otpId: string
      otpEncryptionTargetBundle: string
    }) => void
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
    otpEncryptionTargetBundle: null,
    config: null,

    // Actions
    initialize: (config: AuthConfig) => {
      set((state) => ({
        auth: {
          ...state.auth,
          config,
          enabledMethods: config.enabledMethods,
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
      const previousStep = newHistory.pop() ?? 'sign-up'
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
          otpEncryptionTargetBundle: null,
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

    setOtpSession: ({ otpId, otpEncryptionTargetBundle }) => {
      set((state) => ({
        auth: {
          ...state.auth,
          otpId,
          otpEncryptionTargetBundle,
        },
      }))
    },
  },
})
