'use client'

import {
  type UseMutationOptions,
  type UseMutationResult,
  useMutation,
} from '@tanstack/react-query'
import { type Config, type ResolvedRegister, useConfig } from 'wagmi'
import { exportWallet } from '../actions.js'

type ConfigParameter<config extends Config = Config> = {
  config?: Config | config | undefined
}

/**
 * Hook to export wallet seed phrase
 */
export function useExportWallet<
  config extends Config = ResolvedRegister['config'],
  context = unknown,
>(
  parameters: useExportWallet.Parameters<config, context> = {},
): useExportWallet.ReturnType<context> {
  const { mutation } = parameters
  const config = useConfig(parameters)

  return useMutation({
    ...mutation,
    async mutationFn(variables: exportWallet.Parameters) {
      return exportWallet(config, variables)
    },
    mutationKey: ['exportWallet'],
  })
}

export declare namespace useExportWallet {
  type Parameters<
    config extends Config = Config,
    context = unknown,
  > = ConfigParameter<config> & {
    mutation?:
      | UseMutationOptions<
          exportWallet.ReturnType,
          exportWallet.ErrorType,
          exportWallet.Parameters,
          context
        >
      | undefined
  }

  type ReturnType<context = unknown> = UseMutationResult<
    exportWallet.ReturnType,
    exportWallet.ErrorType,
    exportWallet.Parameters,
    context
  >
}
