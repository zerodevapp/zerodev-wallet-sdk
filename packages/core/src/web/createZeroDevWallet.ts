import {
  createZeroDevWalletCore,
  type ZeroDevWalletConfigCore,
  type ZeroDevWalletSDK,
} from '../core/createZeroDevWalletCore.js'
import { createIndexedDbStamper } from '../stampers/indexedDbStamper.js'
import type { ApiKeyStamper, PasskeyStamper } from '../stampers/types.js'
import { createWebauthnStamper } from '../stampers/webauthnStamper.js'
import { createWebStorageAdapter } from '../storage/adapters.js'
import type { StorageAdapter } from '../storage/manager.js'

/**
 * Web config: all four web-defaulted fields are optional overrides.
 * `rpId` falls back to `window.location.hostname`; the others fall back to
 * IndexedDB / WebAuthn / sessionStorage-backed implementations. RN consumers
 * go through `@zerodev/wallet-core/react-native`, which exposes the strict
 * `ZeroDevWalletConfigCore` shape directly.
 */
export type ZeroDevWalletConfig = Omit<
  ZeroDevWalletConfigCore,
  'apiKeyStamper' | 'passkeyStamper' | 'rpId' | 'sessionStorage'
> & {
  rpId?: string
  sessionStorage?: StorageAdapter
  apiKeyStamper?: ApiKeyStamper
  passkeyStamper?: PasskeyStamper
}

export async function createZeroDevWallet(
  config: ZeroDevWalletConfig,
): Promise<ZeroDevWalletSDK> {
  const rpId = config.rpId ?? window.location.hostname
  const apiKeyStamper = config.apiKeyStamper ?? (await createIndexedDbStamper())
  const passkeyStamper =
    config.passkeyStamper ?? (await createWebauthnStamper({ rpId }))
  const sessionStorage = config.sessionStorage ?? createWebStorageAdapter()

  return createZeroDevWalletCore({
    ...config,
    rpId,
    apiKeyStamper,
    passkeyStamper,
    sessionStorage,
  })
}
