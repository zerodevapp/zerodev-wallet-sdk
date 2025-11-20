'use client'

import {
  type UseMutationOptions,
  type UseMutationResult,
  useMutation,
} from '@tanstack/react-query'
import { type Config, type ResolvedRegister, useConfig } from 'wagmi'
import { verifyOTP } from '../actions.js'

type ConfigParameter<config extends Config = Config> = {
  config?: Config | config | undefined
}

/**
 * Hook to verify OTP code
 */
export function useVerifyOTP<
  config extends Config = ResolvedRegister['config'],
  context = unknown,
>(
  parameters: useVerifyOTP.Parameters<config, context> = {},
): useVerifyOTP.ReturnType<context> {
  const { mutation } = parameters
  const config = useConfig(parameters)

  return useMutation({
    ...mutation,
    async mutationFn(variables: verifyOTP.Parameters) {
      return verifyOTP(config, variables)
    },
    mutationKey: ['verifyOTP'],
  })
}

export declare namespace useVerifyOTP {
  type Parameters<
    config extends Config = Config,
    context = unknown,
  > = ConfigParameter<config> & {
    mutation?:
      | UseMutationOptions<
          verifyOTP.ReturnType,
          verifyOTP.ErrorType,
          verifyOTP.Parameters,
          context
        >
      | undefined
  }

  type ReturnType<context = unknown> = UseMutationResult<
    verifyOTP.ReturnType,
    verifyOTP.ErrorType,
    verifyOTP.Parameters,
    context
  >
}
