import type { StateCreator } from 'zustand'
import type { AuthStep } from './types'

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

/**
 * Why the `wallet-connecting` step stopped waiting. Not always a failure: a
 * request the wallet still holds (EIP-1193 `-32002`) renders as waiting.
 */
export type ConnectFailure = {
  title: string
  message: string
  /** The wallet still has the request open; render as waiting. */
  pending: boolean
}

export type PendingWallet = {
  /** wagmi connector uid, resolved via useConnectors. */
  connectorUid: string
  name: string
  icon?: string | undefined
}

export interface AuthStoreSlice {
  auth: {
    // State
    step: AuthStep | null
    stepHistory: AuthStep[]
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

    /**
     * External wallet the `wallet-connecting` step is driving. That page owns
     * the wagmi connect() call; the wallet button only records intent.
     */
    pendingWallet: PendingWallet | null
    /** Outcome shown on the connecting page. */
    connectError: ConnectFailure | null
    /** Record the wallet and move to `wallet-connecting`. */
    startWalletConnect: (wallet: PendingWallet) => void
    setConnectError: (failure: ConnectFailure | null) => void
    /**
     * Forget the pending wallet. Called on success and by reset(), not when
     * the user leaves: the open request may still be approved later.
     */
    clearPendingWallet: () => void

    // Actions
    /** Restore a persisted OTP session (survives reloads mid-email-flow). */
    initialize: () => void
    goToStep: (step: AuthStep | null) => void
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
    step: null,
    stepHistory: [],
    email: null,
    otpId: null,
    otpEncryptionTargetBundle: null,
    pendingWallet: null,
    connectError: null,

    // Actions
    initialize: () => {
      const stored = readStoredOtpSession()
      if (!stored) return
      set((state) => ({
        auth: {
          ...state.auth,
          otpId: stored.otpId,
          otpEncryptionTargetBundle: stored.otpEncryptionTargetBundle,
        },
      }))
    },

    goToStep: (step: AuthStep | null) => {
      set((state) => ({
        auth: {
          ...state.auth,
          step,
          // `null` ends the flow: clear the history so the next open has no
          // stale back arrow.
          stepHistory:
            step === null
              ? []
              : state.auth.step === null
                ? state.auth.stepHistory
                : [...state.auth.stepHistory, state.auth.step],
        },
      }))
    },

    goBack: () => {
      const { auth } = get()
      if (auth.stepHistory.length === 0) return
      const newHistory = [...auth.stepHistory]
      const previousStep = newHistory.pop()!
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
          step: null,
          stepHistory: [],
          email: null,
          otpId: null,
          otpEncryptionTargetBundle: null,
          pendingWallet: null,
          connectError: null,
        },
      }))
    },

    startWalletConnect: (wallet) => {
      set((state) => ({
        auth: {
          ...state.auth,
          pendingWallet: wallet,
          connectError: null,
          step: 'wallet-connecting',
          stepHistory:
            state.auth.step === null
              ? state.auth.stepHistory
              : [...state.auth.stepHistory, state.auth.step],
        },
      }))
    },

    setConnectError: (failure) => {
      set((state) => ({
        auth: { ...state.auth, connectError: failure },
      }))
    },

    clearPendingWallet: () => {
      set((state) => ({
        auth: { ...state.auth, pendingWallet: null, connectError: null },
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
