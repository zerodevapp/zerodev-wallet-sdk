/** Base stamper that transport depends on */
export type Stamp = {
  stampHeaderName: string
  stampHeaderValue: string
}

export type Stamper = {
  /** retrieve public key compressed or otherwise as per the stamper */
  getPublicKey: () => Promise<string | null>
  /** produce Turnkey header value for a given request body */
  stamp: (payload: string) => Promise<Stamp>
  /** clear local state (embedded key, IDB keypair, etc.) */
  clear: () => Promise<void>
}

export type KeyFormat = 'Hexadecimal' | 'Solana'

export type IframeStamper = Stamper & {
  init(): Promise<string>
  injectCredentialBundle(bundle: string): Promise<boolean>
  injectWalletExportBundle(
    bundle: string,
    organizationId: string,
  ): Promise<boolean>
  injectKeyExportBundle(
    bundle: string,
    organizationId: string,
    keyFormat?: KeyFormat,
  ): Promise<boolean>
  applySettings(settings: { styles?: Record<string, string> }): Promise<boolean>
}

export type IndexedDbStamper = Stamper & {
  resetKeyPair: (externalKeyPair?: CryptoKeyPair) => Promise<void>
}
export type WebauthnStamper = Stamper
