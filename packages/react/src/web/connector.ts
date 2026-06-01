import type { CreateConnectorFn } from '@wagmi/core'
import {
  type ConnectorCoreParams,
  zeroDevWalletCore,
} from '../core/connector.js'

export type { WalletMode } from '../core/connector.js'

/**
 * Web connector params. `fetchOptions` is intentionally omitted — browsers
 * ignore custom `Origin` overrides, and the Turnkey/AA bundler ACLs already
 * accept the browser's native origin. Power users who need to customize the
 * AA bundler/paymaster fetch can drop to `zeroDevWalletCore`.
 */
export type ZeroDevWalletConnectorParams = Omit<
  ConnectorCoreParams,
  'fetchOptions'
>

export function zeroDevWallet(
  params: ZeroDevWalletConnectorParams,
): CreateConnectorFn {
  return zeroDevWalletCore(params)
}
