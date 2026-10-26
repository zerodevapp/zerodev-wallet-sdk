import { waitForBackend } from '../helpers/backend-health.js'
import { BACKEND_URL } from '../helpers/constants.js'
import { REQUIRED_SERVER_WALLET_ENV } from '../helpers/server-wallet.js'

export async function setup() {
  if (!process.env.ZD_PROJECT_ID || !process.env.ZD_OTP_PROJECT_ID) {
    throw new Error(
      'ZD_PROJECT_ID and ZD_OTP_PROJECT_ID are required for the staging backend e2e tests',
    )
  }

  // Mailosaur needs credentials where Guerrilla needed none, so say which one
  // is missing here rather than letting every email test time out waiting for
  // mail that was never going to arrive.
  if (!process.env.MAILOSAUR_API_KEY || !process.env.MAILOSAUR_SERVER_ID) {
    throw new Error(
      'MAILOSAUR_API_KEY and MAILOSAUR_SERVER_ID are required for the staging backend e2e tests',
    )
  }

  /**
   * Helper to make sure all environment variables needed to test server wallets
   * have been set
   */
  const missingServerWallet = REQUIRED_SERVER_WALLET_ENV.filter(
    (name) => !process.env[name],
  )
  if (missingServerWallet.length > 0) {
    throw new Error(
      `${missingServerWallet.join(', ')} are required for the server wallet backend e2e tests (see .env.example)`,
    )
  }

  await waitForBackend(BACKEND_URL)
}
