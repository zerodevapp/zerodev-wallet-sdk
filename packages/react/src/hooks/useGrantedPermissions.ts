'use client'

import {
  type UseQueryOptions,
  type UseQueryResult,
  useQuery,
} from '@tanstack/react-query'
import { type Config, type ResolvedRegister, useConfig } from 'wagmi'
import { getGrantedPermissions } from '../permissions/getGrantedPermissions.js'

type ConfigParameter<config extends Config = Config> = {
  config?: Config | config | undefined
}

/** Hook to list the permissions this wallet granted that are still usable. */
export function useGrantedPermissions<
  config extends Config = ResolvedRegister['config'],
>(
  parameters: useGrantedPermissions.Parameters<config> = {},
): useGrantedPermissions.ReturnType {
  const { query } = parameters
  const config = useConfig(parameters)

  return useQuery({
    ...query,
    queryKey: ['grantedPermissions'],
    queryFn: () => getGrantedPermissions(config),
    enabled: Boolean(config),
  })
}

export declare namespace useGrantedPermissions {
  type Parameters<config extends Config = Config> = ConfigParameter<config> & {
    query?:
      | Omit<
          UseQueryOptions<
            getGrantedPermissions.ReturnType,
            getGrantedPermissions.ErrorType,
            getGrantedPermissions.ReturnType
          >,
          'queryKey' | 'queryFn'
        >
      | undefined
  }

  type ReturnType = UseQueryResult<
    getGrantedPermissions.ReturnType,
    getGrantedPermissions.ErrorType
  >
}
