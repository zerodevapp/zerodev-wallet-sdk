'use client'

import {
  type UseMutationOptions,
  type UseMutationResult,
  useMutation,
} from '@tanstack/react-query'
import { type Config, type ResolvedRegister, useConfig } from 'wagmi'
import { exportPrivateKey } from '../actions.js'

type ConfigParameter<config extends Config = Config> = {
  config?: Config | config | undefined
}

/**
 * Hook to export private key
 */
export function useExportPrivateKey<
  config extends Config = ResolvedRegister['config'],
  context = unknown,
>(
  parameters: useExportPrivateKey.Parameters<config, context> = {},
): useExportPrivateKey.ReturnType<context> {
  const { mutation } = parameters
  const config = useConfig(parameters)

  return useMutation({
    ...mutation,
    async mutationFn(variables: exportPrivateKey.Parameters) {
      return exportPrivateKey(config, variables)
    },
    mutationKey: ['exportPrivateKey'],
  })
}

export declare namespace useExportPrivateKey {
  type Parameters<
    config extends Config = Config,
    context = unknown,
  > = ConfigParameter<config> & {
    mutation?:
      | UseMutationOptions<
          exportPrivateKey.ReturnType,
          exportPrivateKey.ErrorType,
          exportPrivateKey.Parameters,
          context
        >
      | undefined
  }

  type ReturnType<context = unknown> = UseMutationResult<
    exportPrivateKey.ReturnType,
    exportPrivateKey.ErrorType,
    exportPrivateKey.Parameters,
    context
  >
}
