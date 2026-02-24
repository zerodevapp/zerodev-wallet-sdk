'use client'

import {
  type UseMutationOptions,
  type UseMutationResult,
  useMutation,
} from '@tanstack/react-query'
import { type Config, type ResolvedRegister, useConfig } from 'wagmi'
import { sendMagicLink } from '../actions.js'

type ConfigParameter<config extends Config = Config> = {
  config?: Config | config | undefined
}

/**
 * Hook to send a magic link via email
 */
export function useSendMagicLink<
  config extends Config = ResolvedRegister['config'],
  context = unknown,
>(
  parameters: useSendMagicLink.Parameters<config, context> = {},
): useSendMagicLink.ReturnType<context> {
  const { mutation } = parameters
  const config = useConfig(parameters)

  return useMutation({
    ...mutation,
    async mutationFn(variables: sendMagicLink.Parameters) {
      return sendMagicLink(config, variables)
    },
    mutationKey: ['sendMagicLink'],
  })
}

export declare namespace useSendMagicLink {
  type Parameters<
    config extends Config = Config,
    context = unknown,
  > = ConfigParameter<config> & {
    mutation?:
      | UseMutationOptions<
          sendMagicLink.ReturnType,
          sendMagicLink.ErrorType,
          sendMagicLink.Parameters,
          context
        >
      | undefined
  }

  type ReturnType<context = unknown> = UseMutationResult<
    sendMagicLink.ReturnType,
    sendMagicLink.ErrorType,
    sendMagicLink.Parameters,
    context
  >
}
