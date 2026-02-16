'use client'

import {
  type UseQueryOptions,
  type UseQueryResult,
  useQuery,
} from '@tanstack/react-query'
import { type Config, type ResolvedRegister, useConfig } from 'wagmi'
import { getUserEmail } from '../actions.js'

type ConfigParameter<config extends Config = Config> = {
  config?: Config | config | undefined
}

/**
 * Hook to fetch user email address
 */
export function useGetUserEmail<
  config extends Config = ResolvedRegister['config'],
>(parameters: useGetUserEmail.Parameters<config>): useGetUserEmail.ReturnType {
  const { query } = parameters
  const config = useConfig(parameters)

  return useQuery({
    ...query,
    queryKey: ['getUserEmail'],
    queryFn: async () => {
      return getUserEmail(config)
    },
    enabled: Boolean(config),
  })
}

export declare namespace useGetUserEmail {
  type Parameters<config extends Config = Config> = ConfigParameter<config> & {
    query?:
      | Omit<
          UseQueryOptions<
            getUserEmail.ReturnType,
            getUserEmail.ErrorType,
            getUserEmail.ReturnType
          >,
          'queryKey' | 'queryFn'
        >
      | undefined
  }

  type ReturnType = UseQueryResult<
    getUserEmail.ReturnType,
    getUserEmail.ErrorType
  >
}
