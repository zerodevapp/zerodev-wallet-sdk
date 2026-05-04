import { sha256, stringToBytes } from 'viem'

export const OAUTH_PROVIDERS = {
  GOOGLE: 'google',
} as const

export type OAuthProvider =
  (typeof OAUTH_PROVIDERS)[keyof typeof OAUTH_PROVIDERS]

const GOOGLE_OAUTH_HOST = 'accounts.google.com'

/**
 * Compute the OIDC nonce that the backend will embed in the Google login URL.
 *
 * Mirrors the backend's `turnkeyOAuthNonce` (Go):
 *   `hex(sha256(utf8_bytes_of(pub_key_hex_lowercase_no_0x)))`
 *
 * NB: this hashes the *ASCII bytes of the hex string*, not the decoded
 * pubkey bytes. Must stay in sync with
 * `internal/app-server/services/oauth/client_impl.go:turnkeyOAuthNonce`.
 */
export function generateOAuthNonce(publicKey: string): string {
  const hex = publicKey.replace(/^0x/, '').toLowerCase()
  return sha256(stringToBytes(hex)).replace(/^0x/, '')
}

/**
 * Verify a Google OAuth login URL returned by the doorway-kms backend.
 *
 * Throws if:
 * - the URL is malformed,
 * - the host isn't `accounts.google.com`,
 * - the `nonce` query param is missing or doesn't equal
 *   `generateOAuthNonce(publicKey)`.
 *
 * The nonce binding ensures a malicious backend can't substitute its own
 * session pubkey at the Turnkey OIDC step — Turnkey requires the id_token's
 * nonce to match the hash of the pubkey it's logging in for.
 */
export function verifyGoogleLoginUrl(
  loginUrl: string,
  publicKey: string,
): void {
  let parsed: URL
  try {
    parsed = new URL(loginUrl)
  } catch {
    throw new Error('login URL is not a valid URL')
  }
  if (parsed.host !== GOOGLE_OAUTH_HOST) {
    throw new Error(
      `login URL host mismatch: expected ${GOOGLE_OAUTH_HOST}, got ${parsed.host}`,
    )
  }
  const nonce = parsed.searchParams.get('nonce')
  if (!nonce) throw new Error('login URL missing nonce')
  const expected = generateOAuthNonce(publicKey)
  if (nonce.toLowerCase() !== expected.toLowerCase()) {
    throw new Error('login URL nonce does not match public key hash')
  }
}
