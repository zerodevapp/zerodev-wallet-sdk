import { type Hex, sha256 } from 'viem'

export const OAUTH_PROVIDERS = {
  GOOGLE: 'google',
} as const

export type OAuthProvider =
  (typeof OAUTH_PROVIDERS)[keyof typeof OAUTH_PROVIDERS]

export type OAuthConfig = {
  googleClientId?: string
  redirectUri: string
}

export type OAuthFlowParams = {
  provider: OAuthProvider
  clientId: string
  redirectUri: string
  nonce: string
  state?: Record<string, string>
}

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'

const POPUP_WIDTH = 500
const POPUP_HEIGHT = 600

export function buildOAuthUrl(params: OAuthFlowParams): string {
  const { provider, clientId, redirectUri, nonce, state } = params

  if (provider !== OAUTH_PROVIDERS.GOOGLE) {
    throw new Error(`Unsupported OAuth provider: ${provider}`)
  }

  const authUrl = new URL(GOOGLE_AUTH_URL)
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('response_type', 'id_token')
  authUrl.searchParams.set('scope', 'openid email profile')
  authUrl.searchParams.set('nonce', nonce)
  authUrl.searchParams.set('prompt', 'select_account')

  let stateParam = `provider=${provider}`
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

export function extractOAuthToken(url: string): string | null {
  const hashParams = new URLSearchParams(url.split('#')[1])
  let idToken = hashParams.get('id_token')

  if (!idToken) {
    const queryParams = new URLSearchParams(url.split('?')[1])
    idToken = queryParams.get('id_token')
  }

  return idToken
}

export function pollOAuthPopup(
  authWindow: Window,
  originUrl: string,
  onSuccess: (token: string) => void,
  onError: (error: Error) => void,
): void {
  const interval = setInterval(() => {
    try {
      if (authWindow.closed) {
        clearInterval(interval)
        onError(new Error('Authentication window was closed'))
        return
      }

      const url = authWindow.location.href || ''

      if (url.startsWith(originUrl)) {
        const token = extractOAuthToken(url)

        if (token) {
          authWindow.close()
          clearInterval(interval)
          onSuccess(token)
        }
      }
    } catch {
      // Ignore cross-origin errors
    }
  }, 500)
}

export function generateOAuthNonce(publicKey: string): string {
  return sha256(publicKey as Hex).replace(/^0x/, '')
}
