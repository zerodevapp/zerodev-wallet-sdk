import * as Linking from 'expo-linking'
import * as WebBrowser from 'expo-web-browser'
import type { GetOAuthSessionIdFn } from '../../authenticateOAuth.js'

function isExpectedCallback(url: URL, redirectUri: string): boolean {
  const expected = new URL(redirectUri)
  return (
    url.protocol === expected.protocol &&
    url.host === expected.host &&
    url.pathname === expected.pathname
  )
}

/**
 * Races two observation primitives because iOS and Android deliver the
 * backend's OAuth redirect through different OS mechanisms:
 *   - fromDeepLink: the OS wakes the app with the URL via an intent
 *     (typical on Android when the redirect is a verified https app-link).
 *   - fromBrowser:  the in-app auth browser (ASWebAuth on iOS, Chrome
 *     Custom Tabs auth-session on Android) intercepts the redirect
 *     internally and resolves `openAuthSessionAsync` with the URL.
 * Whichever fires first wins.
 */
export function createOAuthGetSessionIdWithExpoWebBrowser(params: {
  redirectUri: string
}): GetOAuthSessionIdFn {
  return async ({ oauthUrl }) => {
    // When the OS wakes the app with the callback URL, this fires.
    // We filter to our OAuth callbacks, extract session_id, and settle
    // fromDeepLink with the promise's own resolver.
    let sub: ReturnType<typeof Linking.addEventListener> | undefined
    const fromDeepLink = new Promise<string>((resolve, reject) => {
      sub = Linking.addEventListener('url', ({ url }) => {
        let parsed: URL
        try {
          parsed = new URL(url)
        } catch {
          return
        }
        if (!isExpectedCallback(parsed, params.redirectUri)) return
        const q = parsed.searchParams
        const error = q.get('error')
        if (error) {
          reject(new Error(error || 'OAuth authentication failed'))
          return
        }
        if (q.get('oauth_success') !== 'true') return
        const sid = q.get('session_id')
        if (sid) resolve(sid)
        else reject(new Error('OAuth redirect missing session_id'))
      })
    })

    // The other path: the auth browser session observes the redirect to
    // redirectUri itself and resolves with the URL. Fires on iOS always,
    // and on Android whenever no verified app-link intent steals it first.
    //
    // `preferUniversalLinks: true` is required on iOS 17.4+ to make
    // ASWebAuthenticationSession intercept HTTPS callbacks via the app's
    // Associated Domains AASA. Without it, iOS falls back to the legacy
    // `callbackURLScheme:` API with "https" as the scheme, which intercepts
    // nothing — the browser sheet stays open and the callback URL loads
    // as a normal web page. No-op on Android.
    const fromBrowser = WebBrowser.openAuthSessionAsync(
      oauthUrl,
      params.redirectUri,
      { preferUniversalLinks: params.redirectUri.startsWith('https:') },
    ).then((r) => {
      if (r.type !== 'success') throw new Error('OAuth cancelled or failed')
      const parsed = new URL(r.url)
      if (!isExpectedCallback(parsed, params.redirectUri)) {
        throw new Error('OAuth callback URL did not match redirectUri')
      }
      const error = parsed.searchParams.get('error')
      if (error) throw new Error(error || 'OAuth authentication failed')
      if (parsed.searchParams.get('oauth_success') !== 'true') {
        throw new Error('OAuth callback missing success marker')
      }
      const sid = parsed.searchParams.get('session_id')
      if (!sid) throw new Error('OAuth redirect missing session_id')
      return sid
    })

    try {
      return await Promise.race([fromDeepLink, fromBrowser])
    } finally {
      // Drop the listener — a leaked subscription would fire on unrelated
      // deep links later in the app's lifetime.
      sub?.remove()
      // Close the auth tab if the deep-link branch settled the race — the
      // OS brought the app to foreground but left the Custom Tab in the
      // back stack. When fromBrowser already won, the auth session has
      // self-dismissed; on iOS that makes dismissBrowser throw "no browser
      // to dismiss" rather than no-op, so we swallow it.
      try {
        await WebBrowser.dismissBrowser()
      } catch {
        // Already closed — desired end state.
      }
    }
  }
}
