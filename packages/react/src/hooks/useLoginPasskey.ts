'use client'

import {
  type UseMutationOptions,
  type UseMutationResult,
  useMutation,
} from '@tanstack/react-query'
import { type Config, type ResolvedRegister, useConfig } from 'wagmi'
import { loginPasskey } from '../actions.js'

type ConfigParameter<config extends Config = Config> = {
  config?: Config | config | undefined
}

/**
 * Hook to login with passkey
 */
export function useLoginPasskey<
  config extends Config = ResolvedRegister['config'],
  context = unknown,
>(
  parameters: useLoginPasskey.Parameters<config, context> = {},
): useLoginPasskey.ReturnType<config, context> {
  const { mutation } = parameters
  const config = useConfig(parameters)

  return useMutation({
    ...mutation,
    async mutationFn(variables: loginPasskey.Parameters) {
      return loginPasskey(config, variables)
    },
    mutationKey: ['loginPasskey'],
  })
}

export declare namespace useLoginPasskey {
  type Parameters<
    config extends Config = Config,
    context = unknown,
  > = ConfigParameter<config> & {
    mutation?:
      | UseMutationOptions<
          loginPasskey.ReturnType,
          loginPasskey.ErrorType,
          loginPasskey.Parameters,
          context
        >
      | undefined
  }

  type ReturnType<
    config extends Config = Config,
    context = unknown,
  > = UseMutationResult<
    loginPasskey.ReturnType,
    loginPasskey.ErrorType,
    loginPasskey.Parameters,
    context
  >
}
