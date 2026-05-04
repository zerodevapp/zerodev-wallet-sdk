export enum SessionType {
  READ_ONLY = 'SESSION_TYPE_READ_ONLY',
  READ_WRITE = 'SESSION_TYPE_READ_WRITE',
}

// TODO: Change `stamperType` to `"apiKey" | "passkey"`
export type StamperType = 'iframe' | 'indexedDb' | 'passkey'

export type ZeroDevWalletSession = {
  id: string
  userId: string
  organizationId: string
  stamperType: StamperType
  sessionType?: SessionType
  token: string
  expiry: number
  createdAt: number
}
