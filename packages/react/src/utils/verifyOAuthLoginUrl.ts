import type { OAuthProvider } from '@zerodev/wallet-core'
import { sha256, stringToBytes } from 'viem'

export type { OAuthProvider }

export const OAUTH_PROVIDERS = {
  GOOGLE: 'google',
  X: 'x',
} as const satisfies Record<string, OAuthProvider>

const OAUTH_HOSTS: Record<OAuthProvider, string> = {
  google: 'accounts.google.com',
  x: 'x.com',
}

/**
 * Compute the OIDC nonce that the backend will embed in the login URL.
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
 * Verify an OAuth login URL returned by the doorway-kms backend.
 *
 * Throws if:
 * - the URL is malformed,
 * - the host isn't the provider's expected host,
 * - the `nonce` query param is missing or doesn't equal
 *   `generateOAuthNonce(publicKey)`.
 *
 * The nonce binding ensures a malicious backend can't substitute its own
 * session pubkey at the Turnkey OIDC step — Turnkey requires the id_token's
 * nonce to match the hash of the pubkey it's logging in for.
 */
export function verifyOAuthLoginUrl(
  provider: OAuthProvider,
  loginUrl: string,
  publicKey: string,
): void {
  let parsed: URL
  try {
    parsed = new URL(loginUrl)
  } catch {
    throw new Error('login URL is not a valid URL')
  }
  const expectedHost = OAUTH_HOSTS[provider]
  if (parsed.host !== expectedHost) {
    throw new Error(
      `login URL host mismatch: expected ${expectedHost}, got ${parsed.host}`,
    )
  }
  const nonce = parsed.searchParams.get('nonce')
  if (!nonce) throw new Error('login URL missing nonce')
  const expected = generateOAuthNonce(publicKey)
  if (nonce.toLowerCase() !== expected.toLowerCase()) {
    throw new Error('login URL nonce does not match public key hash')
  }
}

/**
 * Verify a Google OAuth login URL.
 *
 * @deprecated Use {@link verifyOAuthLoginUrl} with `'google'` instead.
 */
export function verifyGoogleLoginUrl(
  loginUrl: string,
  publicKey: string,
): void {
  verifyOAuthLoginUrl('google', loginUrl, publicKey)
}
