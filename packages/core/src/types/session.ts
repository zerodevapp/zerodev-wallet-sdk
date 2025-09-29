export enum SessionType {
  READ_ONLY = "SESSION_TYPE_READ_ONLY",
  READ_WRITE = "SESSION_TYPE_READ_WRITE",
}

export type StamperType = 'iframe' | 'indexedDb' | 'passkey';

export type DoorwaySession = {
  id: string;
  userId: string;
  organizationId: string;
  stamperType: StamperType;
  sessionType?: SessionType;
  token?: string;
  publicKey?: string;
  expiry: number;
  createdAt: number;
};