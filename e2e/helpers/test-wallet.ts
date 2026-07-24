/**
 * Test-only bridge between the low-level integration client/session and the
 * `wallet: ZeroDevWalletSDK` object the export functions expect, plus a
 * throwaway target public key generator.
 *
 * exportWallet / exportPrivateKey only touch three members of the wallet:
 *   - getSession()  -> { organizationId, stamperType, ... }
 *   - client        -> client.apiKeyStamper | client.passkeyStamper
 *   - toAccount()   -> { address }   (exportPrivateKey only, when address omitted)
 *
 * parseSession() omits `stamperType`, and the integration client's
 * passkeyStamper is a no-op that returns empty stamp headers. The export
 * functions branch on `session.stamperType === 'apiKey'`, so this adapter MUST
 * report `stamperType: 'apiKey'` or Turnkey receives an invalid (empty) stamp.
 */

import { generateKeyPairSync } from 'node:crypto'
import type { ZeroDevWalletClient } from '../../packages/core/src/client/createClient.js'
import type { ZeroDevWalletSDK } from '../../packages/core/src/core/createZeroDevWalletCore.js'

/**
 * Generates a throwaway P-256 keypair and returns its uncompressed public key
 * as hex (65 bytes -> 130 hex chars, `04` prefix). Mirrors the target the real
 * Turnkey export iframe would supply. The private key is discarded because the
 * structural test never decrypts the bundle.
 */
export function generateTargetPublicKey(): string {
  const { publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' })
  const spki = publicKey.export({ type: 'spki', format: 'der' })
  // The last 65 bytes of SPKI DER are the uncompressed point (0x04 || X || Y).
  const uncompressed = spki.subarray(spki.length - 65)
  if (uncompressed[0] !== 0x04) {
    throw new Error('Expected uncompressed public key starting with 0x04')
  }
  return Buffer.from(uncompressed).toString('hex')
}

type BridgeSession = { organizationId: string } & Record<string, unknown>

/**
 * Wraps the integration client + parsed session into the minimal wallet shape
 * the export functions consume. `address` is only used by exportPrivateKey's
 * toAccount() fallback; pass it when known so toAccount() is never relied on.
 */
export function asExportWallet(
  client: ZeroDevWalletClient,
  session: BridgeSession,
  address?: string,
): ZeroDevWalletSDK {
  return {
    getSession: async () => ({ ...session, stamperType: 'apiKey' as const }),
    client,
    toAccount: async () => ({ address }),
  } as unknown as ZeroDevWalletSDK
}
