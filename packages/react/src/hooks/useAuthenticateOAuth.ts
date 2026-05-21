'use client'

import {
  type UseMutationOptions,
  type UseMutationResult,
  useMutation,
} from '@tanstack/react-query'
import { type Config, type ResolvedRegister, useConfig } from 'wagmi'
import {
  authenticateOAuth,
  type GetOAuthSessionIdFn,
} from '../authenticateOAuth.js'
import type { OAuthProvider } from '../utils/verifyGoogleLoginUrl.js'

type ConfigParameter<config extends Config = Config> = {
  config?: Config | config | undefined
}

/**
 * Generic variant — REQUIRES `getSessionId` and `redirectUri` at the hook
 * level. No platform fallback, no auto-wired adapter. Use this when you're
 * providing your own OAuth implementation (e.g. `react-native-app-auth`, a
 * custom popup flow, or any other custom integration).
 *
 * For the blessed Expo-based React Native flow (expo-web-browser +
 * expo-linking deep-link race), import `useAuthenticateOAuthWithExpoWebBrowser`
 * from `@zerodev/wallet-react/react-native/oauth/with-expo-web-browser`
 * instead — it auto-wires the adapter with a `useMemo`, so you only pass
 * `redirectUri`.
 *
 * Importing this generic hook does NOT pull `expo-web-browser` /
 * `expo-linking` into your bundle.
 */
export function useAuthenticateOAuth<
  config extends Config = ResolvedRegister['config'],
  context = unknown,
>(
  parameters: useAuthenticateOAuth.Parameters<config, context>,
): useAuthenticateOAuth.ReturnType<context> {
  const { mutation, getSessionId, redirectUri } = parameters
  const config = useConfig(parameters)

  return useMutation({
    ...mutation,
    async mutationFn(variables: { provider: OAuthProvider }) {
      return authenticateOAuth(config, {
        ...variables,
        getSessionId,
        redirectUri,
      })
    },
    mutationKey: ['authenticateOAuth'],
  })
}

export declare namespace useAuthenticateOAuth {
  type Parameters<
    config extends Config = Config,
    context = unknown,
  > = ConfigParameter<config> & {
    getSessionId: GetOAuthSessionIdFn
    redirectUri: string
    mutation?:
      | UseMutationOptions<
          authenticateOAuth.ReturnType,
          authenticateOAuth.ErrorType,
          { provider: OAuthProvider },
          context
        >
      | undefined
  }

  type ReturnType<context = unknown> = UseMutationResult<
    authenticateOAuth.ReturnType,
    authenticateOAuth.ErrorType,
    { provider: OAuthProvider },
    context
  >
}
