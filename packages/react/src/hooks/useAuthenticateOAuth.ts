'use client'

import {
  type UseMutationOptions,
  type UseMutationResult,
  useMutation,
} from '@tanstack/react-query'
import { type Config, type ResolvedRegister, useConfig } from 'wagmi'
import { authenticateOAuth } from '../authenticateOAuth.js'

type ConfigParameter<config extends Config = Config> = {
  config?: Config | config | undefined
}

/**
 * Hook to authenticate with OAuth.
 *
 * Platform behavior is configured at the hook level:
 * - With no options → uses built-in web popup + parent polling.
 * - With `timeoutMs` → configures the built-in web popup timeout.
 * - With `getSessionId` + `redirectUri` → uses the consumer-supplied adapter
 *   (e.g. expo-web-browser + expo-linking on React Native).
 */
export function useAuthenticateOAuth<
  config extends Config = ResolvedRegister['config'],
  context = unknown,
>(
  parameters: useAuthenticateOAuth.Parameters<config, context> = {},
): useAuthenticateOAuth.ReturnType<context> {
  const { mutation, getSessionId, redirectUri, timeoutMs } = parameters
  const config = useConfig(parameters)

  return useMutation({
    ...mutation,
    async mutationFn(variables: authenticateOAuth.Parameters) {
      return authenticateOAuth(config, {
        ...variables,
        ...(getSessionId && { getSessionId }),
        ...(redirectUri && { redirectUri }),
        ...(timeoutMs !== undefined && { timeoutMs }),
      })
    },
    mutationKey: ['authenticateOAuth'],
  })
}

export declare namespace useAuthenticateOAuth {
  type Parameters<
    config extends Config = Config,
    context = unknown,
  > = ConfigParameter<config> &
    authenticateOAuth.AdapterOptions & {
      mutation?:
        | UseMutationOptions<
            authenticateOAuth.ReturnType,
            authenticateOAuth.ErrorType,
            authenticateOAuth.Parameters,
            context
          >
        | undefined
    }

  type ReturnType<context = unknown> = UseMutationResult<
    authenticateOAuth.ReturnType,
    authenticateOAuth.ErrorType,
    authenticateOAuth.Parameters,
    context
  >
}
