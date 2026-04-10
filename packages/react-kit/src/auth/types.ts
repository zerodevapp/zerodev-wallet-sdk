export type AuthMethod = 'email' | 'google' | 'passkey' | 'injected-wallet'

export type AuthStep =
  | 'initializing'
  | 'select-method'
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
