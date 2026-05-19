'use client'

import { useMemo } from 'react'
import type { Config, ResolvedRegister } from 'wagmi'
import { useAuthenticateOAuth } from '../hooks/useAuthenticateOAuth.js'
import { createOAuthGetSessionIdWithExpoWebBrowser } from './expoWebBrowser.js'

/**
 * Convenience native hook that auto-wires
 * `createOAuthGetSessionIdWithExpoWebBrowser` (expo-web-browser + expo-linking
 * deep-link race). Consumer supplies only `redirectUri` (their app's deep
 * link).
 *
 * Importing from this subpath commits to installing `expo-web-browser` and
 * `expo-linking`. Consumers using a different OAuth library should import
 * the generic `useAuthenticateOAuth` from `@zerodev/wallet-react/react-native`
 * and supply their own `getSessionId` — that path does not pull these peers.
 */
export function useAuthenticateOAuthWithExpoWebBrowser<
  config extends Config = ResolvedRegister['config'],
  context = unknown,
>(
  parameters: useAuthenticateOAuthWithExpoWebBrowser.Parameters<
    config,
    context
  >,
): useAuthenticateOAuth.ReturnType<context> {
  const { redirectUri } = parameters
  const getSessionId = useMemo(
    () => createOAuthGetSessionIdWithExpoWebBrowser({ redirectUri }),
    [redirectUri],
  )
  return useAuthenticateOAuth({ ...parameters, getSessionId })
}

export declare namespace useAuthenticateOAuthWithExpoWebBrowser {
  // Same as the generic hook's Parameters but with `getSessionId` omitted —
  // it's supplied internally.
  type Parameters<config extends Config = Config, context = unknown> = Omit<
    useAuthenticateOAuth.Parameters<config, context>,
    'getSessionId'
  >
}
