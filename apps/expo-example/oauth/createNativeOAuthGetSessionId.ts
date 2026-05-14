import type { GetOAuthSessionIdFn } from '@zerodev/wallet-react'
import * as Linking from 'expo-linking'
import * as WebBrowser from 'expo-web-browser'

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
export function createNativeOAuthGetSessionId(params: {
  redirectUri: string
}): GetOAuthSessionIdFn {
  return async ({ oauthUrl }) => {
    // fromDeepLink is resolved from *outside* its executor — by the
    // Linking listener below. new Promise's executor runs synchronously,
    // so resolveLink/rejectLink point at this promise's resolvers by the
    // next statement. The `!` tells TS to trust that definite assignment.
    let resolveLink!: (sid: string) => void
    let rejectLink!: (err: Error) => void
    const fromDeepLink = new Promise<string>((res, rej) => {
      resolveLink = res
      rejectLink = rej
    })

    // When the OS wakes the app with the callback URL, this fires.
    // We filter to our OAuth callbacks, extract session_id, and settle
    // fromDeepLink via the captured resolver.
    const sub = Linking.addEventListener('url', ({ url }) => {
      const q = new URL(url).searchParams
      const error = q.get('error')
      if (error) {
        rejectLink(new Error(error || 'OAuth authentication failed'))
        return
      }
      if (q.get('oauth_success') !== 'true') return
      const sid = q.get('session_id')
      if (sid) resolveLink(sid)
      else rejectLink(new Error('OAuth redirect missing session_id'))
    })

    // The other path: the auth browser session observes the redirect to
    // redirectUri itself and resolves with the URL. Fires on iOS always,
    // and on Android whenever no verified app-link intent steals it first.
    const fromBrowser = WebBrowser.openAuthSessionAsync(
      oauthUrl,
      params.redirectUri,
    ).then((r) => {
      if (r.type !== 'success') throw new Error('OAuth cancelled or failed')
      const parsed = new URL(r.url)
      const error = parsed.searchParams.get('error')
      if (error) throw new Error(error || 'OAuth authentication failed')
      const sid = parsed.searchParams.get('session_id')
      if (!sid) throw new Error('OAuth redirect missing session_id')
      return sid
    })

    try {
      return await Promise.race([fromDeepLink, fromBrowser])
    } finally {
      // Drop the listener — a leaked subscription would fire on unrelated
      // deep links later in the app's lifetime.
      sub.remove()
      // Close the auth tab if the deep-link branch settled the race — the
      // OS brought the app to foreground but left the Custom Tab in the
      // back stack. Covers both the success path and the error-redirect
      // rejection path. No-op when fromBrowser already won (the auth
      // session auto-dismisses on redirect interception or user cancel).
      WebBrowser.dismissBrowser()
    }
  }
}
