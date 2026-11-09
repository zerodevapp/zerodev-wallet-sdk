export const BACKEND_URL =
  process.env.KMS_BACKEND_URL || 'https://kms.staging.zerodev.app/api/v1'

export const EMAIL_POLL_INTERVAL_MS = 5_000
export const EMAIL_POLL_TIMEOUT_MS = 60_000

// OTP code length is configured per-project on the backend (wallet.otp_configs);
// the SDK no longer forces it. 6 is the backend default (defaultOtpCodeLength)
// and what test/staging projects use, so parse OTP codes at that length.
export const OTP_CODE_LENGTH = 6

export const HEALTH_CHECK_RETRIES = 5
export const HEALTH_CHECK_INTERVAL_MS = 2_000

/** A cold Next dev compile, plus a wallet extension handshake. */
export const LAB_TIMEOUT_MS = 90_000

export const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/

/** A Solana address, base58 and 32-44 characters. */
export const BASE58_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
