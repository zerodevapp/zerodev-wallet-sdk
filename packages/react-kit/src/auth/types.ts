export type AuthMethod = 'email' | 'google' | 'passkey' | 'injected-wallet'

export type AuthStep =
  | 'initializing'
  | 'select-method'
  | 'all-methods'
  | 'email-input'
  | 'email-verification'
  | 'otp-input'
  | 'verifying-otp'
  | 'passkey-prompt'
  | 'oauth-in-progress'
  | 'wallet-selection'
  | 'authenticated'
  | 'error'

export interface AuthConfig {
  magicLinkBaseUrl: string
  enabledMethods: AuthMethod[]
  onSuccess?: () => void
  onError?: (error: unknown) => void
}

export interface AuthStoreState {
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
  submitAuthOtp: () => void
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
