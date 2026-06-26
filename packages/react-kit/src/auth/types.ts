export type AuthMethod = 'email' | 'google' | 'passkey'

export type AuthStep =
  | 'sign-up'
  | 'email-verification'
  | 'otp-input'
  | 'verifying-otp'
  | 'passkey-prompt'
  | 'oauth-in-progress'
  | 'wallet-selection'
  | 'authenticated'
  | 'error'

export type EmailAuthMethod = 'magicLink' | 'otp'

export interface AuthConfig {
  enabledMethods: AuthMethod[]
  emailAuthMethod?: EmailAuthMethod
  termsAndConditionsUrl?: string
  privacyPolicyUrl?: string
  onSuccess?: () => void
  onError?: (error: unknown) => void
}
