import type { StateCreator } from 'zustand'
import type { AuthConfig, AuthMethod, AuthStep } from './types'

const OTP_SESSION_STORAGE_KEY = 'zerodev:auth:otpSession'

type StoredOtpSession = {
  otpId: string
  otpEncryptionTargetBundle: string
}

function readStoredOtpSession(): StoredOtpSession | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(OTP_SESSION_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredOtpSession
    if (!parsed?.otpId || !parsed?.otpEncryptionTargetBundle) return null
    return parsed
  } catch {
    return null
  }
}

function writeStoredOtpSession(session: StoredOtpSession): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(
      OTP_SESSION_STORAGE_KEY,
      JSON.stringify(session),
    )
  } catch {
    // ignore
  }
}

function clearStoredOtpSession(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(OTP_SESSION_STORAGE_KEY)
  } catch {
    // ignore
  }
}

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
    /** Clear the persisted OTP session after a successful verify. */
    clearOtpSession: () => void
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
      const stored = readStoredOtpSession()
      set((state) => ({
        auth: {
          ...state.auth,
          config,
          enabledMethods: config.enabledMethods,
          ...(stored && {
            otpId: stored.otpId,
            otpEncryptionTargetBundle: stored.otpEncryptionTargetBundle,
          }),
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
      clearStoredOtpSession()
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
      writeStoredOtpSession({ otpId, otpEncryptionTargetBundle })
      set((state) => ({
        auth: {
          ...state.auth,
          otpId,
          otpEncryptionTargetBundle,
        },
      }))
    },

    clearOtpSession: () => {
      clearStoredOtpSession()
      set((state) => ({
        auth: {
          ...state.auth,
          otpId: null,
          otpEncryptionTargetBundle: null,
        },
      }))
    },
  },
})
