export enum SessionType {
  READ_ONLY = 'SESSION_TYPE_READ_ONLY',
  READ_WRITE = 'SESSION_TYPE_READ_WRITE',
}

export type StamperType = 'apiKey' | 'passkey'

export type ZeroDevWalletSession = {
  id: string
  userId: string
  organizationId: string
  stamperType: StamperType
  sessionType?: SessionType
  token: string
  /** Public key bound into the session JWT; persisted for crash recovery. */
  publicKey?: string
  expiry: number
  createdAt: number
}
