'use client'

import {
  type UseMutationOptions,
  type UseMutationResult,
  useMutation,
} from '@tanstack/react-query'
import { type Config, type ResolvedRegister, useConfig } from 'wagmi'
import { refreshSession } from '../actions.js'

type ConfigParameter<config extends Config = Config> = {
  config?: Config | config | undefined
}

/**
 * Hook to manually refresh session
 */
export function useRefreshSession<
  config extends Config = ResolvedRegister['config'],
  context = unknown,
>(
  parameters: useRefreshSession.Parameters<context> = {},
): useRefreshSession.ReturnType<context> {
  const { mutation } = parameters
  const config = useConfig(parameters)

  return useMutation({
    ...mutation,
    async mutationFn(variables: refreshSession.Parameters) {
      return refreshSession(config, variables)
    },
    mutationKey: ['refreshSession'],
  })
}

export declare namespace useRefreshSession {
  type Parameters<context = unknown> = ConfigParameter & {
    mutation?:
      | UseMutationOptions<
          refreshSession.ReturnType,
          refreshSession.ErrorType,
          refreshSession.Parameters,
          context
        >
      | undefined
  }

  type ReturnType<context = unknown> = UseMutationResult<
    refreshSession.ReturnType,
    refreshSession.ErrorType,
    refreshSession.Parameters,
    context
  >
}
