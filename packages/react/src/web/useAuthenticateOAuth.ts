'use client'

import {
  type UseMutationOptions,
  type UseMutationResult,
  useMutation,
} from '@tanstack/react-query'
import { type Config, type ResolvedRegister, useConfig } from 'wagmi'
import { authenticateOAuth } from '../authenticateOAuth.js'
import { getSessionIdWeb } from '../getSessionIdWeb.js'
import type { OAuthProvider } from '../utils/verifyGoogleLoginUrl.js'

type ConfigParameter<config extends Config = Config> = {
  config?: Config | config | undefined
}

/**
 * Web variant — hard-wires the popup-based `getSessionIdWeb` flow and
 * `window.location.href` as the redirect URI. Consumers needing a custom
 * OAuth flow call `authenticateOAuth` directly.
 *
 * `timeoutMs` (optional) configures how long the popup-polling flow may run
 * before it fails. Defaults to 5 minutes (defined in `getSessionIdWeb`).
 */
export function useAuthenticateOAuth<
  config extends Config = ResolvedRegister['config'],
  context = unknown,
>(
  parameters: useAuthenticateOAuth.Parameters<config, context> = {},
): useAuthenticateOAuth.ReturnType<context> {
  const { mutation, timeoutMs } = parameters
  const config = useConfig(parameters)

  return useMutation({
    ...mutation,
    async mutationFn(variables: { provider: OAuthProvider }) {
      return authenticateOAuth(config, {
        ...variables,
        getSessionId: ({ oauthUrl }) =>
          getSessionIdWeb(oauthUrl, window.location.origin, timeoutMs),
        redirectUri: window.location.href,
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
    /** Popup-polling timeout in ms. Defaults to 5 minutes. */
    timeoutMs?: number
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
