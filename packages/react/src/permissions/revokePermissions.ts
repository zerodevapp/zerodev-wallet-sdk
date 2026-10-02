import type { Config } from '@wagmi/core'
import { numberToHex } from 'viem'
import { getZeroDevConnector } from '../actions.js'

export type RevokePermissionsParameters = {
  /** The `permissionsContext` returned when the permission was granted. */
  permissionsContext: string
  /** Chain the permission was granted on. Defaults to the connected chain. */
  chainId?: number
}

export type RevokePermissionsReturnType = {
  /** `uninstall` for a permission already used on-chain, `invalidate-nonce` for one never used. */
  method: 'uninstall' | 'invalidate-nonce'
  transactionHash: `0x${string}`
}

/**
 * Revokes a granted permission on-chain from the user's account, so the
 * session key stops working whatever its holder does. Sends ERC-7715
 * `wallet_revokeExecutionPermission` to the ZeroDev provider.
 */
export async function revokePermissions(
  config: Config,
  params: RevokePermissionsParameters,
): Promise<RevokePermissionsReturnType> {
  const provider = (await getZeroDevConnector(config).getProvider()) as {
    request(args: {
      method: 'wallet_revokeExecutionPermission'
      params: [{ permissionContext: string; chainId?: `0x${string}` }]
    }): Promise<RevokePermissionsReturnType>
  }
  return provider.request({
    method: 'wallet_revokeExecutionPermission',
    params: [
      {
        permissionContext: params.permissionsContext,
        ...(params.chainId && { chainId: numberToHex(params.chainId) }),
      },
    ],
  })
}

export declare namespace revokePermissions {
  type Parameters = RevokePermissionsParameters
  type ReturnType = RevokePermissionsReturnType
  type ErrorType = Error
}
