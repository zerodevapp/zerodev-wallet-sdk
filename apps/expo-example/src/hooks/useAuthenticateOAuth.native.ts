import { useAuthenticateOAuth as useBase } from '@zerodev/wallet-react'
import { useMemo } from 'react'
import { OAUTH_REDIRECT_URI } from '@/config/auth'
import { createNativeOAuthGetSessionId } from '@/oauth/createNativeOAuthGetSessionId'

export function useAuthenticateOAuth() {
  const getSessionId = useMemo(
    () => createNativeOAuthGetSessionId({ redirectUri: OAUTH_REDIRECT_URI }),
    [],
  )
  return useBase({ getSessionId, redirectUri: OAUTH_REDIRECT_URI })
}
