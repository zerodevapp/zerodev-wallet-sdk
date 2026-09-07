export type AuthMethod = 'email' | 'google' | 'passkey' | 'external-wallet'

export type AuthStep =
  | 'sign-up'
  | 'email-verification'
  | 'otp-input'
  | 'verifying-otp'
  | 'passkey-prompt'
  | 'oauth-in-progress'
  | 'authenticated'
  | 'error'

export type EmailAuthMethod = 'magicLink' | 'otp'
