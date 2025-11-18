'use client'

import {
  type UseMutationOptions,
  type UseMutationResult,
  useMutation,
} from '@tanstack/react-query'
import { type Config, type ResolvedRegister, useConfig } from 'wagmi'
import { registerPasskey } from '../actions.js'

type ConfigParameter<config extends Config = Config> = {
  config?: Config | config | undefined
}

/**
 * Hook to register with passkey
 */
export function useRegisterPasskey<
  config extends Config = ResolvedRegister['config'],
  context = unknown,
>(
  parameters: useRegisterPasskey.Parameters<config, context> = {},
): useRegisterPasskey.ReturnType<config, context> {
  const { mutation } = parameters
  const config = useConfig(parameters)

  return useMutation({
    ...mutation,
    async mutationFn(variables: registerPasskey.Parameters) {
      return registerPasskey(config, variables)
    },
    mutationKey: ['registerPasskey'],
  })
}

export declare namespace useRegisterPasskey {
  type Parameters<
    config extends Config = Config,
    context = unknown,
  > = ConfigParameter<config> & {
    mutation?:
      | UseMutationOptions<
          registerPasskey.ReturnType,
          registerPasskey.ErrorType,
          registerPasskey.Parameters,
          context
        >
      | undefined
  }

  type ReturnType<
    config extends Config = Config,
    context = unknown,
  > = UseMutationResult<
    registerPasskey.ReturnType,
    registerPasskey.ErrorType,
    registerPasskey.Parameters,
    context
  >
}
