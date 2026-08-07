import { waitForBackend } from '../helpers/backend-health.js'
import { BACKEND_URL } from '../helpers/constants.js'
import { ping } from '../helpers/temp-email.js'

export async function setup() {
  if (!process.env.ZD_PROJECT_ID || !process.env.ZD_OTP_PROJECT_ID) {
    throw new Error(
      'ZD_PROJECT_ID and ZD_OTP_PROJECT_ID are required for staging integration tests',
    )
  }

  await waitForBackend(BACKEND_URL)
  await ping()
}
