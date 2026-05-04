const POPUP_WIDTH = 500
const POPUP_HEIGHT = 600

function openOAuthPopup(url: string): Window | null {
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

export async function getSessionIdWeb(
  oauthUrl: string,
  expectedOrigin: string,
  timeoutMs = 5 * 60 * 1000,
): Promise<string> {
  const popup = openOAuthPopup(oauthUrl)
  if (!popup) throw new Error('Failed to open OAuth login window')
  return pollPopupForSession(popup, expectedOrigin, timeoutMs)
}

function pollPopupForSession(
  popup: Window,
  expectedOrigin: string,
  timeoutMs: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearInterval(pollId)
      clearTimeout(timeoutId)
    }
    const timeoutId = setTimeout(() => {
      cleanup()
      popup.close()
      reject(new Error(`OAuth timed out after ${timeoutMs}ms`))
    }, timeoutMs)
    const pollId = setInterval(() => {
      try {
        // Read URL before checking popup.closed: if the OAuth callback page
        // calls window.close() between polls, Chromium still exposes the
        // success URL on the closed popup, and we want to honor it.
        const url = new URL(popup.location.href)
        if (url.origin === expectedOrigin) {
          const error = url.searchParams.get('error')
          if (error) {
            cleanup()
            popup.close()
            reject(new Error(error || 'OAuth authentication failed'))
            return
          }

          if (url.searchParams.get('oauth_success') === 'true') {
            const sid = url.searchParams.get('session_id')
            cleanup()
            popup.close()
            if (sid) resolve(sid)
            else reject(new Error('OAuth redirect missing session_id'))
            return
          }
        }
      } catch {
        // while popup is on provider/backend
        // reads throw DOMException (cross-origin) so we ignore — keep polling
      }
      if (popup.closed) {
        cleanup()
        reject(new Error('OAuth popup was closed'))
      }
    }, 250)
  })
}
