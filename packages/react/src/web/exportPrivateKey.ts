import type { Config, Connector } from '@wagmi/core'
import {
  createIframeStamper,
  exportPrivateKey as exportPrivateKeySdk,
} from '@zerodev/wallet-core'
import {
  getZeroDevConnector,
  getZeroDevStore,
  getZeroDevWallet,
} from '../actions.js'

/**
 * Export private key (web — uses Turnkey iframe stamper)
 */
export async function exportPrivateKey(
  config: Config,
  parameters: {
    iframeContainerId: string
    iframeStyles?: Record<string, string>
    address?: string
    keyFormat?: 'Hexadecimal' | 'Solana'
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
    iframeElementId: 'export-private-key-iframe',
  })

  const publicKey = await iframeStamper.init()

  if (parameters.iframeStyles) {
    await iframeStamper.applySettings({ styles: parameters.iframeStyles })
  }

  const { exportBundle, organizationId } = await exportPrivateKeySdk({
    wallet,
    targetPublicKey: publicKey,
    ...(parameters.address && { address: parameters.address }),
  })

  const success = await iframeStamper.injectKeyExportBundle(
    exportBundle,
    organizationId,
    parameters.keyFormat ?? 'Hexadecimal',
  )
  if (success !== true) {
    throw new Error('Failed to inject export bundle')
  }
}

export declare namespace exportPrivateKey {
  type Parameters = {
    iframeContainerId: string
    iframeStyles?: Record<string, string>
    address?: string
    keyFormat?: 'Hexadecimal' | 'Solana'
    connector?: Connector
  }
  type ReturnType = void
  type ErrorType = Error
}
