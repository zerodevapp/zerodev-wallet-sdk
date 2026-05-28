import type { CreateConnectorFn } from '@wagmi/core'
import type {
  ApiKeyStamper,
  PasskeyStamper,
  StorageAdapter,
} from '@zerodev/wallet-core'
import {
  type ConnectorCoreParams,
  zeroDevWalletCore,
} from '../core/connector.js'
import { originFromRpId } from '../utils/originFromRpId.js'

export type { WalletMode } from '../core/connector.js'

/**
 * React Native connector params. The four adapter fields are required —
 * unlike web, RN has no platform-native defaults for them. `fetchOptions`
 * is dropped from the public surface; the wrapper derives it from `rpId`
 * so both the Turnkey transport and the AA bundler/paymaster transports
 * receive `Origin: https://${rpId}`. Power users who need a different
 * Origin can drop to `zeroDevWalletCore`.
 */
export type ZeroDevWalletConnectorParams = Omit<
  ConnectorCoreParams,
  | 'apiKeyStamper'
  | 'passkeyStamper'
  | 'rpId'
  | 'sessionStorage'
  | 'fetchOptions'
> & {
  rpId: string
  apiKeyStamper: ApiKeyStamper | Promise<ApiKeyStamper>
  passkeyStamper: PasskeyStamper | Promise<PasskeyStamper>
  sessionStorage: StorageAdapter
}

export function zeroDevWallet(
  params: ZeroDevWalletConnectorParams,
): CreateConnectorFn {
  return zeroDevWalletCore({
    ...params,
    fetchOptions: {
      headers: { Origin: originFromRpId(params.rpId) },
    },
  })
}
