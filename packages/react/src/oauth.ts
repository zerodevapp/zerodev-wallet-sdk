import { sha256, stringToBytes } from 'viem'

export const OAUTH_PROVIDERS = {
  GOOGLE: 'google',
} as const

export type OAuthProvider =
  (typeof OAUTH_PROVIDERS)[keyof typeof OAUTH_PROVIDERS]

const GOOGLE_OAUTH_HOST = 'accounts.google.com'

const POPUP_WIDTH = 500
const POPUP_HEIGHT = 600

export function openOAuthPopup(url: string): Window | null {
  const width = POPUP_WIDTH
  const height = POPUP_HEIGHT
  const left = window.screenX + (window.innerWidth - width) / 2
  const top = window.screenY + (window.innerHeight - height) / 2

  const authWindow = window.open(
    'about:blank',
    '_blank',
    `width=${width},height=${height},top=${top},left=${left},scrollbars=yes,resizable=yes`,
  )

  if (authWindow) {
    authWindow.location.href = url
  }

  return authWindow
}

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

export type OAuthMessageData = {
  type: 'oauth_success' | 'oauth_error'
  sessionId?: string
  error?: string
}

/**
 * Listen for OAuth completion via postMessage from popup
 * The popup sends a message when it detects a successful redirect
 */
export function listenForOAuthMessage(
  authWindow: Window,
  expectedOrigin: string,
  onSuccess: (sessionId: string) => void,
  onError: (error: Error) => void,
): () => void {
  let cleaned = false

  const handleMessage = (event: MessageEvent<OAuthMessageData>) => {
    // Only trust messages from expected origin
    if (event.origin !== expectedOrigin) return
    if (!event.data || typeof event.data !== 'object') return

    if (event.data.type === 'oauth_success') {
      cleanup()
      onSuccess(event.data.sessionId || '')
    } else if (event.data.type === 'oauth_error') {
      cleanup()
      onError(new Error(event.data.error || 'OAuth authentication failed'))
    }
  }

  const checkWindowClosed = setInterval(() => {
    if (authWindow.closed) {
      cleanup()
      onError(new Error('Authentication window was closed'))
    }
  }, 500)

  const cleanup = () => {
    if (cleaned) return
    cleaned = true
    window.removeEventListener('message', handleMessage)
    clearInterval(checkWindowClosed)
  }

  window.addEventListener('message', handleMessage)

  return cleanup
}

/**
 * Handle OAuth callback on the return page
 * Call this on the page that receives the OAuth redirect
 * It sends a postMessage to the opener and closes the window
 */
export function handleOAuthCallback(successParam = 'oauth_success'): boolean {
  const urlParams = new URLSearchParams(window.location.search)
  const isSuccess = urlParams.get(successParam) === 'true'
  const error = urlParams.get('error')
  const sessionId = urlParams.get('session_id') ?? undefined

  if (window.opener) {
    if (isSuccess) {
      const message: OAuthMessageData = { type: 'oauth_success' }
      if (sessionId) message.sessionId = sessionId
      window.opener.postMessage(message, window.location.origin)
      window.close()
      return true
    }
    if (error) {
      window.opener.postMessage(
        { type: 'oauth_error', error } satisfies OAuthMessageData,
        window.location.origin,
      )
      window.close()
      return false
    }
  }

  return false
}
