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

export type ApiKeyStamper = Stamper & {
  /** Generate + activate a new key pair immediately (simple cases: login init, logout). */
  resetKeyPair: () => Promise<void>
  /** Generate a new key pair internally, return its compressed public key, but keep the OLD key active for stamp(). */
  prepareKeyRotation: () => Promise<string>
  /** Promote the pending key to active. Call after the server accepts the new key. */
  commitKeyRotation: () => Promise<void>
}
export type Attestation = {
  attestationObject: string
  clientDataJson: string
  credentialId: string
}

export type PasskeyRegistrationOptions = {
  rp: { id: string; name: string }
  userName: string
}

export type PasskeyRegistrationResult = {
  attestation: Attestation
  encodedChallenge: string
}

export type PasskeyStamper = Stamper & {
  /** Create a new passkey credential. Owns challenge and user ID generation internally. */
  register: (
    options: PasskeyRegistrationOptions,
  ) => Promise<PasskeyRegistrationResult>
}
