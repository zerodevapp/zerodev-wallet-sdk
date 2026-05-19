import { useAuthenticateOAuthWithExpoWebBrowser } from '@zerodev/wallet-react/react-native/oauth/with-expo-web-browser'
import { OAUTH_REDIRECT_URI } from '@/config/auth'

export function useAuthenticateOAuth() {
  return useAuthenticateOAuthWithExpoWebBrowser({
    redirectUri: OAUTH_REDIRECT_URI,
  })
}
