export const DEFAULT_SESSION_EXPIRATION_IN_SECONDS = '900' // default to 15 minutes
export const DEFAULT_IFRAME_CONTAINER_ID = 'turnkey-auth-iframe-container-id'
export const DEFAULT_IFRAME_ELEMENT_ID = 'turnkey-default-iframe-element-id'
export const DEFAULT_ORGANIZATION_ID = '0d98e826-dd8f-44ca-a585-3afcd27d4002'
export const KMS_SERVER_URL = 'https://kms.staging.zerodev.app'

// Pinned ECDSA P-256 public key (uncompressed, 65 bytes hex) of Turnkey's
// TLS Fetcher Sign enclave. Used to verify the signature on the OTP encryption
// target bundle returned by /auth/init/otp before HPKE-encrypting the OTP
// attempt. The bundle's `dataSignature` is verified against this key, so a
// compromised proxy cannot substitute its own ephemeral key.
export const TURNKEY_TLS_FETCHER_SIGN_PUBLIC_KEY =
  '046b4f88421f76b6ba418afc2ea1d8ced671337d7db6b80478a60d8531bf8f17fa9a512f0fef96fc0c9b4cd9dff70b34992e520ce04c79d931f6ff6296b547d201'
