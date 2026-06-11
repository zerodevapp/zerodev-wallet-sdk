import * as Linking from 'expo-linking'
import { Platform } from 'react-native'

// RP_ID needs to match the domain that hosts /.well-known/assetlinks.json
// (shared across contributors; see README "Running with Passkeys on Android").
export const RP_ID = 'zerodev-expo-example.vercel.app'

export const buildRedirectUri = (path: string): string =>
  `https://${RP_ID}/${path}`

// Magic-link verification always goes through the universal/app link
export const VERIFY_EMAIL_REDIRECT_URI = buildRedirectUri('verify-email')

// OAuth defaults to the universal/app link, but can be switched to the
// custom scheme via env
const oauthUseCustomScheme =
  process.env.EXPO_PUBLIC_OAUTH_USE_CUSTOM_SCHEME === 'true'

// iOS only observes https OAuth redirects through ASWebAuthenticationSession's
// `.https(host:path:)` callback, which requires iOS 17.4+. Older versions
// can't complete the https flow, so fall back to the custom scheme there.
const supportsHttpsOAuthCallback =
  Platform.OS !== 'ios' || Number.parseFloat(String(Platform.Version)) >= 17.4

export const OAUTH_REDIRECT_URI =
  oauthUseCustomScheme || !supportsHttpsOAuthCallback
    ? Linking.createURL('oauth-callback')
    : buildRedirectUri('oauth-callback')
