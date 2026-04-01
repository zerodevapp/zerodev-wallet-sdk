import type { ZeroDevWalletSDK } from '../core/createZeroDevWallet.js'
import type { KeyFormat } from '../stampers/types.js'

export type ExportPrivateKeyParameters = {
  /** Wallet to use for the export */
  wallet: ZeroDevWalletSDK
  /** Target public key from export iframe for encryption */
  targetPublicKey: string
  /** Wallet address to export (optional, defaults to wallet's account address) */
  address?: string
}

/**
 * Export a wallet account's private key
 *
 * This calls Turnkey's export_wallet_account API to get an encrypted bundle
 * containing the account's private key. The bundle is encrypted with the
 * targetPublicKey (from Turnkey's export iframe).
 *
 * @param params - Export parameters
 * @returns Encrypted export bundle and metadata
 *
 * @example
 * ```ts
 * // In UI: Initialize export iframe first
 * const iframeStamper = await createIframeStamper({
 *   iframeUrl: 'https://export.turnkey.com',
 *   iframeContainer: document.getElementById('export-container'),
 *   iframeElementId: 'export-iframe'
 * });
 * const targetPublicKey = await iframeStamper.init();
 *
 * // Call SDK to get encrypted bundle
 * const { exportBundle, address, organizationId } = await exportPrivateKey({
 *   wallet,
 *   targetPublicKey
 * });
 *
 * // Inject into iframe to display private key
 * await iframeStamper.injectKeyExportBundle(exportBundle, organizationId, 'Hexadecimal');
 * ```
 */
export async function exportPrivateKey(
  params: ExportPrivateKeyParameters,
): Promise<{ exportBundle: string; address: string; organizationId: string }> {
  const { targetPublicKey, wallet, address: addressParam } = params

  const session = await wallet.getSession()
  if (!session) {
    throw new Error('Session not found')
  }
  const { organizationId } = session

  // If address not provided, get it from the wallet's account
  let address = addressParam
  if (!address) {
    const account = await wallet.toAccount()
    if (!account?.address) {
      throw new Error('Could not get address from wallet account')
    }
    address = account.address
  }

  const exportBody = JSON.stringify({
    type: 'ACTIVITY_TYPE_EXPORT_WALLET_ACCOUNT',
    timestampMs: Date.now().toString(),
    organizationId: organizationId,
    parameters: {
      address: address,
      targetPublicKey,
    },
  })

  // TODO: Change `stamperType` to `"apiKey" | "passkey"`
  const stamperKey =
    session.stamperType === 'indexedDb' ? 'apiKeyStamper' : 'passkeyStamper'
  const stamper = wallet.client[stamperKey]
  if (!stamper) {
    throw new Error(`Stamper '${stamperKey}' not found on wallet.client`)
  }

  const exportStamp = await stamper.stamp(exportBody)
  if (!exportStamp) {
    throw new Error('Failed to stamp export body')
  }

  const exportResponse = await fetch(
    'https://api.turnkey.com/public/v1/submit/export_wallet_account',
    {
      method: 'POST',
      body: exportBody,
      headers: {
        [exportStamp.stampHeaderName]: exportStamp.stampHeaderValue,
      },
    },
  )
  if (!exportResponse.ok) {
    const errorText = await exportResponse.text()
    throw new Error(
      `Failed to export wallet account: ${exportResponse.status} ${errorText}`,
    )
  }
  const exportData = await exportResponse.json()

  const exportBundle =
    exportData?.activity?.result?.exportWalletAccountResult?.exportBundle

  if (!exportBundle) {
    throw new Error(
      `Export bundle not found in response: ${JSON.stringify(exportData)}`,
    )
  }

  return { exportBundle, address: address!, organizationId }
}

export type { KeyFormat }
