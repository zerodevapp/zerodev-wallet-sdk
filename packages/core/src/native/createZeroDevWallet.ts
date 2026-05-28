import {
  createZeroDevWalletCore,
  type ZeroDevWalletConfigCore,
  type ZeroDevWalletSDK,
} from '../core/createZeroDevWalletCore.js'
import { originFromRpId } from '../utils/originFromRpId.js'

/**
 * React Native config — mirrors `web/createZeroDevWallet.ts`'s wrapper
 * pattern. RN consumers must supply all four adapter fields up front
 * (no platform-native defaults exist for IndexedDB/WebAuthn). The only
 * RN-specific defaulting is `fetchOptions`: when omitted, we derive the
 * `Origin` header from `rpId` (`https://${rpId}` by default, or the rpId
 * verbatim if it already carries an `http://` / `https://` scheme — useful
 * in dev). Power users wanting a different Origin can pass `fetchOptions`
 * explicitly.
 */
export type ZeroDevWalletConfig = ZeroDevWalletConfigCore

export async function createZeroDevWallet(
  config: ZeroDevWalletConfig,
): Promise<ZeroDevWalletSDK> {
  return createZeroDevWalletCore({
    ...config,
    fetchOptions: config.fetchOptions ?? {
      headers: { Origin: originFromRpId(config.rpId) },
    },
  })
}
