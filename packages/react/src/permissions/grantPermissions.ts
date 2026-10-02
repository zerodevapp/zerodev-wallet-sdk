import type { Config } from '@wagmi/core'
import { getZeroDevConnector } from '../actions.js'
import {
  type Erc7715GrantPermissionsResponse,
  toErc7715Request,
} from './erc7715.js'
import type {
  GrantPermissionsParameters,
  GrantPermissionsReturnType,
} from './types.js'

/**
 * Lets another key act on the user's smart account within limits. Sends
 * ERC-7715 `wallet_grantPermissions` to the ZeroDev provider, the same request
 * viem's `grantPermissions` (viem/experimental) sends, so there is one
 * implementation behind both.
 *
 * The user's embedded wallet signs once; nothing is sent on-chain until the
 * session key's first user operation, which installs the permission.
 */
export async function grantPermissions(
  config: Config,
  params: GrantPermissionsParameters,
): Promise<GrantPermissionsReturnType> {
  // wallet_grantPermissions is not in viem's EIP-1193 method table, so the
  // provider is typed by the one call made here.
  const provider = (await getZeroDevConnector(config).getProvider()) as {
    request(args: {
      method: 'wallet_grantPermissions'
      params: [ReturnType<typeof toErc7715Request>]
    }): Promise<Erc7715GrantPermissionsResponse>
  }
  const response = await provider.request({
    method: 'wallet_grantPermissions',
    params: [toErc7715Request(params)],
  })

  return {
    permissionsContext: response.permissionsContext,
    account: response.signerData.submitToAddress,
    signer: params.signer,
    chainId: Number.parseInt(response.chainId, 16),
    expiry: response.expiry,
  }
}

export declare namespace grantPermissions {
  type Parameters = GrantPermissionsParameters
  type ReturnType = GrantPermissionsReturnType
  type ErrorType = Error
}
