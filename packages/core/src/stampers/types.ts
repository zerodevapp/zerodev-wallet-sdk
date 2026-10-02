/** Base stamper that transport depends on */
export type Stamp = {
  stampHeaderName: string
  stampHeaderValue: string
}

export type Stamper = {
  /** produce Turnkey header value for a given request body */
  stamp: (payload: string) => Promise<Stamp>
  /** clear local state (embedded key, IDB keypair, etc.) */
  clear: () => Promise<void>
}

export type KeyFormat = 'Hexadecimal' | 'Solana'

export type IframeStamper = Stamper & {
  /** retrieve public key compressed or otherwise as per the stamper */
  getPublicKey: () => Promise<string | null>
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

/**
 * Anything that can sign a payload and identify its key: the session key in the
 * browser, an agent key on a server, or a hardware-backed signer.
 * `Client`, `ClientConfig`, and `Transport` require only this.
 */
export type SigningStamper = Stamper & {
  /** retrieve public key compressed or otherwise as per the stamper */
  getPublicKey: () => Promise<string | null>
  /**
   * Sign `payload` with the currently active key. Returns a hex-encoded
   * ECDSA-P256 / SHA-256 signature in ASN.1 DER form.
   */
  sign: (payload: string) => Promise<string>
}

/**
 * A signing stamper that owns its key material and can replace it. The login
 * flows in `createZeroDevWalletCore` need the rotation methods; nothing else does.
 */
export type ApiKeyStamper = SigningStamper & {
  /** Generate + activate a new key pair immediately (simple cases: login init, logout). */
  resetKeyPair: () => Promise<void>
  /** Generate a new key pair internally, return its compressed public key, but keep the OLD key active for stamp(). */
  prepareKeyRotation: () => Promise<string>
  /** Stamp with the prepared key without making it active. */
  stampPending: (payload: string) => Promise<Stamp>
  /** Sign with the prepared key without making it active. */
  signPending: (payload: string) => Promise<string>
  /** Promote the pending key to active. Call after the server accepts the new key. */
  commitKeyRotation: () => Promise<void>
  /** Forget the prepared key while keeping the active key untouched. */
  discardKeyRotation: () => Promise<void>
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
