import {
  KeyFormat,
  IframeStamper as TurnkeyIframeStamper,
} from '@turnkey/iframe-stamper'
import type { IframeStamper, KeyFormat as KeyFormatType } from './types.js'

export async function createIframeStamper(cfg: {
  iframeUrl: string
  iframeContainer: HTMLElement | null | undefined
  iframeElementId: string
}): Promise<IframeStamper> {
  const inner = new TurnkeyIframeStamper({
    iframeUrl: cfg.iframeUrl,
    iframeContainer: cfg.iframeContainer,
    iframeElementId: cfg.iframeElementId,
  })

  return {
    async init() {
      return await inner.init()
    },
    async injectCredentialBundle(bundle: string) {
      return await inner.injectCredentialBundle(bundle)
    },
    async getPublicKey() {
      return await inner.getEmbeddedPublicKey()
    },
    async stamp(payload: string) {
      return await inner.stamp(payload)
    },
    async clear() {
      await inner.clear()
    },
    async injectWalletExportBundle(bundle: string, organizationId: string) {
      return await inner.injectWalletExportBundle(bundle, organizationId)
    },
    async injectKeyExportBundle(
      bundle: string,
      organizationId: string,
      keyFormat?: KeyFormatType,
    ) {
      return await inner.injectKeyExportBundle(
        bundle,
        organizationId,
        keyFormat ? KeyFormat[keyFormat] : KeyFormat.Hexadecimal,
      )
    },
    async applySettings(settings: { styles?: Record<string, string> }) {
      return await inner.applySettings(settings)
    },
  }
}
