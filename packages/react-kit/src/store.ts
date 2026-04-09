import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { AuthConfig, AuthMethod, AuthStep } from './auth'
import type { PendingRequest } from './types.js'

export type State = {
  pendingRequest: PendingRequest | null
  userConfirmationListenerActive: boolean
  setPendingRequest: (request: PendingRequest | null) => void
  setUserConfirmationListenerActive: (active: boolean) => void

  // Auth state
  authStep: AuthStep
  authStepHistory: AuthStep[]
  authAvailableMethods: AuthMethod[]
  authEmail: string | null
  authOtpId: string | null
  authError: { message: string; recoverable: boolean } | null
  authPendingMethod: AuthMethod | null
  authResendAvailableAt: number | null
  authConfig: AuthConfig | null

  // Auth actions
  initializeAuth: (config: AuthConfig) => Promise<void>
  selectAuthMethod: (method: AuthMethod) => void
  showAllAuthMethods: () => void
  submitAuthEmail: (email: string) => void
  submitAuthOtp: (code: string) => void
  switchToOtpInput: () => void
  goBackAuth: () => void
  resetAuth: () => void
  setAuthOtpId: (otpId: string) => void
  setAuthResendAvailableAt: (timestamp: number) => void
  setAuthError: (
    error: { message: string; recoverable: boolean } | null,
  ) => void
  setAuthStep: (step: AuthStep) => void
}

export const createStore = () =>
  create<State>()(
    subscribeWithSelector((set, get) => ({
      pendingRequest: null,
      userConfirmationListenerActive: false,
      setPendingRequest: (request) => set({ pendingRequest: request }),
      setUserConfirmationListenerActive: (active) =>
        set({ userConfirmationListenerActive: active }),

      // Auth initial state
      authStep: 'initializing',
      authStepHistory: [],
      authAvailableMethods: [],
      authEmail: null,
      authOtpId: null,
      authError: null,
      authPendingMethod: null,
      authResendAvailableAt: null,
      authConfig: null,

      // Auth actions
      initializeAuth: async (config: AuthConfig) => {
        set({
          authConfig: config,
          authAvailableMethods: config.enabledMethods,
          authStep: 'select-method',
        })
      },

      selectAuthMethod: (method: AuthMethod) => {
        const { authStep, authStepHistory } = get()
        set({ authPendingMethod: method })

        switch (method) {
          case 'email':
            set({
              authStep: 'email-input',
              authStepHistory: [...authStepHistory, authStep],
            })
            break
          case 'passkey':
            set({
              authStep: 'passkey-prompt',
              authStepHistory: [...authStepHistory, authStep],
            })
            break
          case 'google':
            set({
              authStep: 'oauth-in-progress',
              authStepHistory: [...authStepHistory, authStep],
            })
            break
          case 'injected-wallet':
            set({
              authStep: 'wallet-selection',
              authStepHistory: [...authStepHistory, authStep],
            })
            break
        }
      },

      showAllAuthMethods: () => {
        const { authStep, authStepHistory } = get()
        set({
          authStep: 'all-methods',
          authStepHistory: [...authStepHistory, authStep],
        })
      },

      submitAuthEmail: (email: string) => {
        const { authStep, authStepHistory } = get()
        set({
          authEmail: email,
          authStep: 'email-verification',
          authStepHistory: [...authStepHistory, authStep],
        })
      },

      submitAuthOtp: () => {
        const { authStep, authStepHistory } = get()
        set({
          authStep: 'verifying-otp',
          authStepHistory: [...authStepHistory, authStep],
        })
      },

      switchToOtpInput: () => {
        const { authStep, authStepHistory } = get()
        set({
          authStep: 'otp-input',
          authStepHistory: [...authStepHistory, authStep],
        })
      },

      goBackAuth: () => {
        const { authStepHistory } = get()
        const newHistory = [...authStepHistory]
        const previousStep = newHistory.pop() ?? 'select-method'
        set({
          authStep: previousStep,
          authStepHistory: newHistory,
          authError: null,
        })
      },

      resetAuth: () => {
        set({
          authStep: 'initializing',
          authStepHistory: [],
          authEmail: null,
          authOtpId: null,
          authError: null,
          authPendingMethod: null,
          authResendAvailableAt: null,
        })
      },

      setAuthOtpId: (otpId: string) => {
        set({ authOtpId: otpId })
      },

      setAuthResendAvailableAt: (timestamp: number) => {
        set({ authResendAvailableAt: timestamp })
      },

      setAuthError: (
        error: { message: string; recoverable: boolean } | null,
      ) => {
        set({ authError: error })
      },

      setAuthStep: (step: AuthStep) => {
        set({ authStep: step })
      },
    })),
  )
