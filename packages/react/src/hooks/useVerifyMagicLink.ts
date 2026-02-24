'use client'

import {
  type UseMutationOptions,
  type UseMutationResult,
  useMutation,
} from '@tanstack/react-query'
import { type Config, type ResolvedRegister, useConfig } from 'wagmi'
import { verifyMagicLink } from '../actions.js'

type ConfigParameter<config extends Config = Config> = {
  config?: Config | config | undefined
}

/**
 * Hook to verify a magic link code
 */
export function useVerifyMagicLink<
  config extends Config = ResolvedRegister['config'],
  context = unknown,
>(
  parameters: useVerifyMagicLink.Parameters<config, context> = {},
): useVerifyMagicLink.ReturnType<context> {
  const { mutation } = parameters
  const config = useConfig(parameters)

  return useMutation({
    ...mutation,
    async mutationFn(variables: verifyMagicLink.Parameters) {
      return verifyMagicLink(config, variables)
    },
    mutationKey: ['verifyMagicLink'],
  })
}

export declare namespace useVerifyMagicLink {
  type Parameters<
    config extends Config = Config,
    context = unknown,
  > = ConfigParameter<config> & {
    mutation?:
      | UseMutationOptions<
          verifyMagicLink.ReturnType,
          verifyMagicLink.ErrorType,
          verifyMagicLink.Parameters,
          context
        >
      | undefined
  }

  type ReturnType<context = unknown> = UseMutationResult<
    verifyMagicLink.ReturnType,
    verifyMagicLink.ErrorType,
    verifyMagicLink.Parameters,
    context
  >
}
