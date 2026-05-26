import {
  createZeroDevWalletCore,
  type ZeroDevWalletConfigCore,
  type ZeroDevWalletSDK,
} from '../core/createZeroDevWalletCore.js'

/**
 * React Native config — mirrors `web/createZeroDevWallet.ts`'s wrapper
 * pattern. RN consumers must supply all four adapter fields up front
 * (no platform-native defaults exist for IndexedDB/WebAuthn). The only
 * RN-specific defaulting is `fetchOptions`: when omitted, we set
 * `Origin: https://${rpId}` so Turnkey's ACL accepts the request. Power
 * users wanting a different Origin can pass `fetchOptions` explicitly.
 */
export type ZeroDevWalletConfig = ZeroDevWalletConfigCore

export async function createZeroDevWallet(
  config: ZeroDevWalletConfig,
): Promise<ZeroDevWalletSDK> {
  return createZeroDevWalletCore({
    ...config,
    fetchOptions: config.fetchOptions ?? {
      headers: { Origin: `https://${config.rpId}` },
    },
  })
}
