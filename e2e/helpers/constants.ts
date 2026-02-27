export const BACKEND_URL =
  process.env.KMS_BACKEND_URL || 'https://kms.staging.zerodev.app/api/v1'

export const DEMO_APP_URL = process.env.DEMO_APP_URL || 'http://localhost:3000'

export const EMAIL_POLL_INTERVAL_MS = 5_000
export const EMAIL_POLL_TIMEOUT_MS = 60_000

export const OTP_CODE_LENGTH = 7

export const HEALTH_CHECK_RETRIES = 5
export const HEALTH_CHECK_INTERVAL_MS = 2_000
