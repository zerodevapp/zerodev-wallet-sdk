'use client'

import {
  type UseMutationOptions,
  type UseMutationResult,
  useMutation,
} from '@tanstack/react-query'
import { type Config, type ResolvedRegister, useConfig } from 'wagmi'
import { authenticateOAuth } from '../actions.js'

type ConfigParameter<config extends Config = Config> = {
  config?: Config | config | undefined
}

/**
 * Hook to authenticate with OAuth (opens popup)
 */
export function useAuthenticateOAuth<
  config extends Config = ResolvedRegister['config'],
  context = unknown,
>(
  parameters: useAuthenticateOAuth.Parameters<config, context> = {},
): useAuthenticateOAuth.ReturnType<config, context> {
  const { mutation } = parameters
  const config = useConfig(parameters)

  return useMutation({
    ...mutation,
    async mutationFn(variables: authenticateOAuth.Parameters) {
      return authenticateOAuth(config, variables)
    },
    mutationKey: ['authenticateOAuth'],
  })
}

export declare namespace useAuthenticateOAuth {
  type Parameters<
    config extends Config = Config,
    context = unknown,
  > = ConfigParameter<config> & {
    mutation?:
      | UseMutationOptions<
          authenticateOAuth.ReturnType,
          authenticateOAuth.ErrorType,
          authenticateOAuth.Parameters,
          context
        >
      | undefined
  }

  type ReturnType<
    config extends Config = Config,
    context = unknown,
  > = UseMutationResult<
    authenticateOAuth.ReturnType,
    authenticateOAuth.ErrorType,
    authenticateOAuth.Parameters,
    context
  >
}
