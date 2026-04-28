import { useAuthenticateOAuth as useBase } from '@zerodev/wallet-react'
import { useMemo } from 'react'
import { createNativeOAuthGetSessionId } from '@/oauth/createNativeOAuthGetSessionId'
import { REDIRECT_URI } from '@/oauth/redirectUri'

export function useAuthenticateOAuth() {
  const getSessionId = useMemo(
    () => createNativeOAuthGetSessionId({ redirectUri: REDIRECT_URI }),
    [],
  )
  return useBase({ getSessionId, redirectUri: REDIRECT_URI })
}
