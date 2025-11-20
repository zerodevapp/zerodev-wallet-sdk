'use client'

import {
  type UseMutationOptions,
  type UseMutationResult,
  useMutation,
} from '@tanstack/react-query'
import { type Config, type ResolvedRegister, useConfig } from 'wagmi'
import { sendOTP } from '../actions.js'

type ConfigParameter<config extends Config = Config> = {
  config?: Config | config | undefined
}

/**
 * Hook to send OTP via email
 */
export function useSendOTP<
  config extends Config = ResolvedRegister['config'],
  context = unknown,
>(
  parameters: useSendOTP.Parameters<config, context> = {},
): useSendOTP.ReturnType<context> {
  const { mutation } = parameters
  const config = useConfig(parameters)

  return useMutation({
    ...mutation,
    async mutationFn(variables: sendOTP.Parameters) {
      return sendOTP(config, variables)
    },
    mutationKey: ['sendOTP'],
  })
}

export declare namespace useSendOTP {
  type Parameters<
    config extends Config = Config,
    context = unknown,
  > = ConfigParameter<config> & {
    mutation?:
      | UseMutationOptions<
          sendOTP.ReturnType,
          sendOTP.ErrorType,
          sendOTP.Parameters,
          context
        >
      | undefined
  }

  type ReturnType<context = unknown> = UseMutationResult<
    sendOTP.ReturnType,
    sendOTP.ErrorType,
    sendOTP.Parameters,
    context
  >
}
