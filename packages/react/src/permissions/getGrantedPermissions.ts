import type { Config } from '@wagmi/core'
import type { Address } from 'viem'
import { getZeroDevConnector } from '../actions.js'
import {
  type Erc7715GrantPermissionsRequest,
  fromErc7715Request,
} from './erc7715.js'
import type { GrantPermissionsParameters } from './types.js'

export type GrantedPermission = GrantPermissionsParameters & {
  permissionsContext: string
  /** The user's smart account the permission is on. */
  account: Address
  chainId: number
  /** `active`: installed and usable. `pending`: granted, not used yet, still usable. */
  status: 'active' | 'pending'
  grantedAt: number
}

type ProviderEntry = Erc7715GrantPermissionsRequest & {
  chainId: `0x${string}`
  permissionsContext: string
  signerData: { submitToAddress: Address }
  status: 'active' | 'pending'
  grantedAt: number
}

/**
 * Permissions this wallet granted that the session key can still use,
 * checked against the chain. Sends ERC-7715
 * `wallet_getGrantedExecutionPermissions`. Lists grants made on this device.
 */
export async function getGrantedPermissions(
  config: Config,
): Promise<GrantedPermission[]> {
  const provider = (await getZeroDevConnector(config).getProvider()) as {
    request(args: {
      method: 'wallet_getGrantedExecutionPermissions'
    }): Promise<ProviderEntry[]>
  }
  const entries = await provider.request({
    method: 'wallet_getGrantedExecutionPermissions',
  })
  return entries.map((e) => ({
    ...fromErc7715Request(e),
    permissionsContext: e.permissionsContext,
    account: e.signerData.submitToAddress,
    chainId: Number.parseInt(e.chainId, 16),
    status: e.status,
    grantedAt: e.grantedAt,
  }))
}

export declare namespace getGrantedPermissions {
  type ReturnType = GrantedPermission[]
  type ErrorType = Error
}
