'use client'

import {
  type UseQueryOptions,
  type UseQueryResult,
  useQuery,
} from '@tanstack/react-query'
import { type Config, type ResolvedRegister, useConfig } from 'wagmi'
import { getAuthenticators } from '../actions.js'

type ConfigParameter<config extends Config = Config> = {
  config?: Config | config | undefined
}

/**
 * Hook to fetch all authenticators (oauths, passkeys, emailContacts, apiKeys)
 * for the current user within the connected project/sub-organization.
 */
export function useAuthenticators<
  config extends Config = ResolvedRegister['config'],
>(
  parameters: useAuthenticators.Parameters<config> = {},
): useAuthenticators.ReturnType {
  const { query } = parameters
  const config = useConfig(parameters)

  return useQuery({
    ...query,
    queryKey: ['authenticators'],
    queryFn: async () => {
      return getAuthenticators(config)
    },
    enabled: Boolean(config),
  })
}

export declare namespace useAuthenticators {
  type Parameters<config extends Config = Config> = ConfigParameter<config> & {
    query?:
      | Omit<
          UseQueryOptions<
            getAuthenticators.ReturnType,
            getAuthenticators.ErrorType,
            getAuthenticators.ReturnType
          >,
          'queryKey' | 'queryFn'
        >
      | undefined
  }

  type ReturnType = UseQueryResult<
    getAuthenticators.ReturnType,
    getAuthenticators.ErrorType
  >
}
