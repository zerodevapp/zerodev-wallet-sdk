'use client'

import {
  type UseMutationOptions,
  type UseMutationResult,
  useMutation,
} from '@tanstack/react-query'
import { type Config, type ResolvedRegister, useConfig } from 'wagmi'
import { grantPermissions } from '../permissions/grantPermissions.js'

type ConfigParameter<config extends Config = Config> = {
  config?: Config | config | undefined
}

/**
 * Hook to let a session key (e.g. a server wallet) act on the user's smart
 * account within limits. Show the user what they are granting before calling
 * `mutate`; `SignatureRequest` from `@zerodev/wallet-react-ui` renders it.
 */
export function useGrantPermissions<
  config extends Config = ResolvedRegister['config'],
  context = unknown,
>(
  parameters: useGrantPermissions.Parameters<config, context> = {},
): useGrantPermissions.ReturnType<context> {
  const { mutation } = parameters
  const config = useConfig(parameters)

  return useMutation({
    ...mutation,
    async mutationFn(variables: grantPermissions.Parameters) {
      return grantPermissions(config, variables)
    },
    mutationKey: ['grantPermissions'],
  })
}

export declare namespace useGrantPermissions {
  type Parameters<
    config extends Config = Config,
    context = unknown,
  > = ConfigParameter<config> & {
    mutation?:
      | UseMutationOptions<
          grantPermissions.ReturnType,
          grantPermissions.ErrorType,
          grantPermissions.Parameters,
          context
        >
      | undefined
  }

  type ReturnType<context = unknown> = UseMutationResult<
    grantPermissions.ReturnType,
    grantPermissions.ErrorType,
    grantPermissions.Parameters,
    context
  >
}
