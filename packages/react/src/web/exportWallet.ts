import type { Config, Connector } from '@wagmi/core'
import {
  createIframeStamper,
  exportWallet as exportWalletSdk,
} from '@zerodev/wallet-core'
import {
  getZeroDevConnector,
  getZeroDevStore,
  getZeroDevWallet,
} from '../actions.js'

/**
 * Export wallet (web — uses Turnkey iframe stamper)
 */
export async function exportWallet(
  config: Config,
  parameters: {
    iframeContainerId: string
    iframeStyles?: Record<string, string>
    connector?: Connector
  },
): Promise<void> {
  const connector = parameters.connector ?? getZeroDevConnector(config)
  const store = await getZeroDevStore(connector)
  const wallet = getZeroDevWallet(store)

  const iframeContainer = document.getElementById(parameters.iframeContainerId)
  if (!iframeContainer) {
    throw new Error('Iframe container not found')
  }

  const iframeStamper = await createIframeStamper({
    iframeUrl: 'https://export.turnkey.com',
    iframeContainer,
    iframeElementId: 'export-wallet-iframe',
  })

  const publicKey = await iframeStamper.init()

  if (parameters.iframeStyles) {
    await iframeStamper.applySettings({ styles: parameters.iframeStyles })
  }

  const { exportBundle, organizationId } = await exportWalletSdk({
    wallet,
    targetPublicKey: publicKey,
  })

  const success = await iframeStamper.injectWalletExportBundle(
    exportBundle,
    organizationId,
  )
  if (success !== true) {
    throw new Error('Failed to inject export bundle')
  }
}

export declare namespace exportWallet {
  type Parameters = {
    iframeContainerId: string
    iframeStyles?: Record<string, string>
    connector?: Connector
  }
  type ReturnType = void
  type ErrorType = Error
}
