export type AuthMethod = 'email' | 'google' | 'passkey' | 'injected-wallet'

export type AuthStep =
  | 'initializing'
  | 'select-method'
  | 'all-methods' // "Other login methods" screen
  | 'email-input'
  | 'email-verification' // Waiting for magic link
  | 'otp-input' // Manual OTP code entry
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

export interface AuthState {
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

  // Actions (called by UI)
  initialize: (config: AuthConfig) => Promise<void>
  selectMethod: (method: AuthMethod) => void
  showAllMethods: () => void
  submitEmail: (email: string) => Promise<void>
  submitOtp: (code: string) => Promise<void>
  resendOtp: () => Promise<void>
  switchToOtpInput: () => void
  goBack: () => void
  reset: () => void
}
