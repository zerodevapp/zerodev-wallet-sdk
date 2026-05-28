import type { PasskeyStamper } from './types.js'

const NOT_CONFIGURED_MESSAGE =
  'passkeyStamper is not configured. Pass passkeyStamper to zeroDevWallet({ ... }) — use createReactNativePasskeyStamper({ rpId }) on React Native or createWebauthnStamper({ rpId }) on web.'

/**
 * Internal fallback used when a consumer doesn't supply a `passkeyStamper`.
 * Methods throw on use, so passkey register/login fails with an actionable
 * message — all other flows (apiKey signing, OAuth, OTP) are unaffected.
 */
export function createNoopPasskeyStamper(): PasskeyStamper {
  return {
    async stamp() {
      throw new Error(NOT_CONFIGURED_MESSAGE)
    },
    async register() {
      throw new Error(NOT_CONFIGURED_MESSAGE)
    },
    async clear() {},
  }
}
