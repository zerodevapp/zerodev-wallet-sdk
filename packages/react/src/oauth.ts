import { type Hex, sha256 } from 'viem'

export const OAUTH_PROVIDERS = {
  GOOGLE: 'google',
} as const

export type OAuthProvider =
  (typeof OAUTH_PROVIDERS)[keyof typeof OAUTH_PROVIDERS]

export type BackendOAuthFlowParams = {
  provider: OAuthProvider
  backendUrl: string
  projectId: string
  publicKey: string
  returnTo: string
}

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

export function generateOAuthNonce(publicKey: string): string {
  return sha256(publicKey as Hex).replace(/^0x/, '')
}

/**
 * Build OAuth URL that redirects to backend's OAuth endpoint
 * The backend handles PKCE, client credentials, and token exchange
 */
export function buildBackendOAuthUrl(params: BackendOAuthFlowParams): string {
  const { provider, backendUrl, projectId, publicKey, returnTo } = params

  if (provider !== OAUTH_PROVIDERS.GOOGLE) {
    throw new Error(`Unsupported OAuth provider: ${provider}`)
  }

  const oauthUrl = new URL(`${backendUrl}/oauth/google/login`)
  oauthUrl.searchParams.set('project_id', projectId)
  oauthUrl.searchParams.set('pub_key', publicKey.replace(/^0x/, ''))
  oauthUrl.searchParams.set('return_to', returnTo)

  return oauthUrl.toString()
}

export type OAuthMessageData = {
  type: 'oauth_success' | 'oauth_error'
  error?: string
}

/**
 * Listen for OAuth completion via postMessage from popup
 * The popup sends a message when it detects a successful redirect
 */
export function listenForOAuthMessage(
  authWindow: Window,
  expectedOrigin: string,
  onSuccess: () => void,
  onError: (error: Error) => void,
): () => void {
  let cleaned = false

  const handleMessage = (event: MessageEvent<OAuthMessageData>) => {
    // Only trust messages from expected origin
    if (event.origin !== expectedOrigin) return
    if (!event.data || typeof event.data !== 'object') return

    if (event.data.type === 'oauth_success') {
      cleanup()
      onSuccess()
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

  if (window.opener) {
    if (isSuccess) {
      window.opener.postMessage(
        { type: 'oauth_success' } satisfies OAuthMessageData,
        window.location.origin,
      )
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
