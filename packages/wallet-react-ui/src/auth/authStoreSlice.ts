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

export type PendingWallet = {
  /** wagmi connector uid — the connecting page resolves it via useConnectors. */
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
     * External wallet the `wallet-connecting` step is driving. The step's
     * page owns the wagmi `connect()` call (per-call mutation callbacks are
     * dropped if the component that issued them unmounts, and the sign-up
     * page unmounts on the step change), so the button only records intent.
     */
    pendingWallet: PendingWallet | null
    /** Rejection / failure shown on the connecting page. */
    connectError: string | null
    /** Record the wallet and move to `wallet-connecting`. */
    startWalletConnect: (wallet: PendingWallet) => void
    setConnectError: (message: string | null) => void
    /**
     * Forget the pending wallet. Deliberately NOT called when the user
     * cancels: the wallet's request is still open, and if it is approved
     * later `ConnectWallet` uses this record to recognise the connection and
     * close. Called on success, and by `reset()`.
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
          // `null` ends the flow, so there is nothing to go back to. Without
          // this, an external-wallet success left ['sign-up', …] behind: the
          // external connector's disconnect never runs our reset(), and the
          // next open showed a back arrow into a stale history.
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

    setConnectError: (message) => {
      set((state) => ({
        auth: { ...state.auth, connectError: message },
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
