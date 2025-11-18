'use client'

import {
  type UseMutationOptions,
  type UseMutationResult,
  useMutation,
} from '@tanstack/react-query'
import { type Config, type ResolvedRegister, useConfig } from 'wagmi'
import { logout } from '../actions.js'

type ConfigParameter<config extends Config = Config> = {
  config?: Config | config | undefined
}

/**
 * Hook to logout and clear session
 */
export function useLogout<
  config extends Config = ResolvedRegister['config'],
  context = unknown,
>(
  parameters: useLogout.Parameters<context> = {},
): useLogout.ReturnType<context> {
  const { mutation } = parameters
  const config = useConfig(parameters)

  return useMutation({
    ...mutation,
    async mutationFn(variables: logout.Parameters) {
      return logout(config, variables)
    },
    mutationKey: ['logout'],
  })
}

export declare namespace useLogout {
  type Parameters<context = unknown> = ConfigParameter & {
    mutation?:
      | UseMutationOptions<
          logout.ReturnType,
          logout.ErrorType,
          logout.Parameters,
          context
        >
      | undefined
  }

  type ReturnType<context = unknown> = UseMutationResult<
    logout.ReturnType,
    logout.ErrorType,
    logout.Parameters,
    context
  >
}
