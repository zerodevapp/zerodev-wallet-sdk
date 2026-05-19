import * as Linking from 'expo-linking'

// RP_ID needs to match the domain that hosts /.well-known/assetlinks.json
// (shared across contributors; see README "Running with Passkeys on Android").
export const RP_ID = 'zerodev-expo-example.vercel.app'

export const buildRedirectUri = (path: string): string =>
  `https://${RP_ID}/${path}`

export const OAUTH_REDIRECT_URI = buildRedirectUri('oauth-callback')
export const VERIFY_EMAIL_REDIRECT_URI = buildRedirectUri('verify-email')
