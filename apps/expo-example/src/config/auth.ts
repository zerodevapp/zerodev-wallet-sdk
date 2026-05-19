import * as Linking from 'expo-linking'

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

export const OAUTH_REDIRECT_URI = oauthUseCustomScheme
  ? Linking.createURL('oauth-callback')
  : buildRedirectUri('oauth-callback')
