'use client'

import {
  type UseMutationOptions,
  type UseMutationResult,
  useMutation,
} from '@tanstack/react-query'
import { type Config, type ResolvedRegister, useConfig } from 'wagmi'
import { revokePermissions } from '../permissions/revokePermissions.js'

type ConfigParameter<config extends Config = Config> = {
  config?: Config | config | undefined
}

/** Hook to revoke a granted permission on-chain from the user's account. */
export function useRevokePermissions<
  config extends Config = ResolvedRegister['config'],
  context = unknown,
>(
  parameters: useRevokePermissions.Parameters<config, context> = {},
): useRevokePermissions.ReturnType<context> {
  const { mutation } = parameters
  const config = useConfig(parameters)

  return useMutation({
    ...mutation,
    async mutationFn(variables: revokePermissions.Parameters) {
      return revokePermissions(config, variables)
    },
    mutationKey: ['revokePermissions'],
  })
}

export declare namespace useRevokePermissions {
  type Parameters<
    config extends Config = Config,
    context = unknown,
  > = ConfigParameter<config> & {
    mutation?:
      | UseMutationOptions<
          revokePermissions.ReturnType,
          revokePermissions.ErrorType,
          revokePermissions.Parameters,
          context
        >
      | undefined
  }

  type ReturnType<context = unknown> = UseMutationResult<
    revokePermissions.ReturnType,
    revokePermissions.ErrorType,
    revokePermissions.Parameters,
    context
  >
}
