import type { ZeroDevSignerSDK } from '../core/createZeroDevSigner.js'

export type ExportWalletParameters = {
  /** Signer to use for the export */
  signer: ZeroDevSignerSDK
  /** Target public key from export iframe for encryption */
  targetPublicKey: string
}

/**
 * TODO: Add it as standard action in the SDK when backend is ready
 * Export a wallet's seed phrase
 *
 * This calls Turnkey's export_wallet API to get an encrypted bundle
 * containing the wallet's mnemonic. The bundle is encrypted with the
 * targetPublicKey (from Turnkey's export iframe).
 *
 * @param params - Export parameters
 * @returns Encrypted export bundle
 *
 * @example
 * ```ts
 * // In UI: Initialize export iframe first
 * const iframeStamper = new IframeStamper({
 *   iframeUrl: 'https://export.turnkey.com',
 *   iframeContainer: document.getElementById('export-container')
 * });
 * const targetPublicKey = await iframeStamper.init();
 *
 * // Call SDK to get encrypted bundle
 * const exportBundle = await exportWallet({
 *   signer,
 *   targetPublicKey
 * });
 *
 * // Inject into iframe to display seed phrase
 * await iframeStamper.injectWalletExportBundle(exportBundle, session.organizationId);
 * ```
 */
export async function exportWallet(
  params: ExportWalletParameters,
): Promise<{ exportBundle: string; walletId: string; organizationId: string }> {
  const { targetPublicKey, signer } = params

  try {
    const session = await signer.getSession()
    if (!session) {
      throw new Error('Session not found')
    }
    const { organizationId } = session

    const listWalletsBody = JSON.stringify({
      organizationId,
    })

    const listWalletsStamp = await signer.client?.stamper.stamp(listWalletsBody)
    if (!listWalletsStamp) {
      throw new Error('Failed to stamp list wallets body')
    }

    const listWalletsResponse = await fetch(
      'https://api.turnkey.com/public/v1/query/list_wallets',
      {
        method: 'POST',
        body: listWalletsBody,
        headers: {
          [listWalletsStamp.stampHeaderName]: listWalletsStamp.stampHeaderValue,
        },
      },
    )
    if (!listWalletsResponse.ok) {
      throw new Error('Failed to list wallets')
    }
    const listWalletsData = await listWalletsResponse.json()

    const walletId = listWalletsData.wallets[0].walletId

    const exportWalletBody = JSON.stringify({
      type: 'ACTIVITY_TYPE_EXPORT_WALLET',
      timestampMs: Date.now().toString(),
      organizationId: organizationId,
      parameters: {
        walletId: walletId,
        targetPublicKey,
        language: 'MNEMONIC_LANGUAGE_ENGLISH',
      },
    })
    const exportWalletStamp =
      await signer.client?.stamper.stamp(exportWalletBody)
    if (!exportWalletStamp) {
      throw new Error('Failed to stamp export wallet body')
    }
    const exportWalletResponse = await fetch(
      'https://api.turnkey.com/public/v1/submit/export_wallet',
      {
        method: 'POST',
        body: exportWalletBody,
        headers: {
          [exportWalletStamp.stampHeaderName]:
            exportWalletStamp.stampHeaderValue,
        },
      },
    )
    if (!exportWalletResponse.ok) {
      throw new Error('Failed to export wallet')
    }
    const exportWalletData = await exportWalletResponse.json()

    const exportBundle =
      exportWalletData?.activity?.result?.exportWalletResult?.exportBundle

    if (!exportBundle) {
      throw new Error('Export bundle not found in response')
    }

    return { exportBundle, walletId, organizationId }
  } catch (_) {
    throw new Error('Error exporting wallet')
  }
}
