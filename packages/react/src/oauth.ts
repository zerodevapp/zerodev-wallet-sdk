import { type Hex, sha256 } from 'viem'

export const OAUTH_PROVIDERS = {
  GOOGLE: 'google',
  APPLE: 'apple',
  FACEBOOK: 'facebook',
} as const

export type OAuthProvider =
  (typeof OAUTH_PROVIDERS)[keyof typeof OAUTH_PROVIDERS]

export type OAuthConfig = {
  googleClientId?: string
  appleClientId?: string
  facebookClientId?: string
  redirectUri: string
  openInPage?: boolean // If true, redirects current page. If false, opens popup
}

export type OAuthFlowParams = {
  provider: OAuthProvider
  clientId: string
  redirectUri: string
  nonce: string
  openInPage: boolean
  state?: Record<string, string>
}

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const APPLE_AUTH_URL = 'https://appleid.apple.com/auth/authorize'
const FACEBOOK_AUTH_URL = 'https://www.facebook.com/v12.0/dialog/oauth'

const POPUP_WIDTH = 500
const POPUP_HEIGHT = 600

/**
 * Build OAuth URL for a provider
 */
export function buildOAuthUrl(params: OAuthFlowParams): string {
  const { provider, clientId, redirectUri, nonce, openInPage, state } = params
  const flow = openInPage ? 'redirect' : 'popup'

  let authUrl: URL

  switch (provider) {
    case OAUTH_PROVIDERS.GOOGLE: {
      authUrl = new URL(GOOGLE_AUTH_URL)
      authUrl.searchParams.set('client_id', clientId)
      authUrl.searchParams.set('redirect_uri', redirectUri)
      authUrl.searchParams.set('response_type', 'id_token')
      authUrl.searchParams.set('scope', 'openid email profile')
      authUrl.searchParams.set('nonce', nonce)
      authUrl.searchParams.set('prompt', 'select_account')
      break
    }

    case OAUTH_PROVIDERS.APPLE: {
      authUrl = new URL(APPLE_AUTH_URL)
      authUrl.searchParams.set('client_id', clientId)
      authUrl.searchParams.set('redirect_uri', redirectUri)
      authUrl.searchParams.set('response_type', 'code id_token')
      authUrl.searchParams.set('response_mode', 'fragment')
      authUrl.searchParams.set('scope', 'name email')
      authUrl.searchParams.set('nonce', nonce)
      break
    }

    case OAUTH_PROVIDERS.FACEBOOK: {
      authUrl = new URL(FACEBOOK_AUTH_URL)
      authUrl.searchParams.set('client_id', clientId)
      authUrl.searchParams.set('redirect_uri', redirectUri)
      authUrl.searchParams.set('response_type', 'token')
      authUrl.searchParams.set('scope', 'email,public_profile')
      authUrl.searchParams.set('nonce', nonce)
      break
    }

    default:
      throw new Error(`Unsupported OAuth provider: ${provider}`)
  }

  // Add state parameter
  let stateParam = `provider=${provider}&flow=${flow}`
  if (state) {
    const additionalState = Object.entries(state)
      .map(
        ([key, value]) =>
          `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
      )
      .join('&')
    if (additionalState) {
      stateParam += `&${additionalState}`
    }
  }
  authUrl.searchParams.set('state', stateParam)

  return authUrl.toString()
}

/**
 * Open OAuth popup window
 */
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
 * Extract OAuth token from URL (hash or query params)
 */
export function extractOAuthToken(url: string): string | null {
  // Try hash params first (Google, Apple use this)
  const hashParams = new URLSearchParams(url.split('#')[1])
  let idToken = hashParams.get('id_token')

  // Try query params as fallback (some providers use this)
  if (!idToken) {
    const queryParams = new URLSearchParams(url.split('?')[1])
    idToken = queryParams.get('id_token')
  }

  return idToken
}

/**
 * Poll OAuth popup for completion
 */
export function pollOAuthPopup(
  authWindow: Window,
  originUrl: string,
  onSuccess: (token: string) => void,
  onError: (error: Error) => void,
): void {
  const interval = setInterval(() => {
    try {
      // Check if window was closed without completing auth
      if (authWindow.closed) {
        clearInterval(interval)
        onError(new Error('Authentication window was closed'))
        return
      }

      const url = authWindow.location.href || ''

      // Check if redirected back to our origin
      if (url.startsWith(originUrl)) {
        const token = extractOAuthToken(url)

        if (token) {
          authWindow.close()
          clearInterval(interval)
          onSuccess(token)
        }
      }
    } catch {
      // Ignore cross-origin errors (expected while popup is on OAuth provider domain)
    }
  }, 500)
}

/**
 * Generate OAuth nonce from wallet public key
 */
export function generateOAuthNonce(publicKey: string): string {
  return sha256(publicKey as Hex).replace(/^0x/, '')
}
