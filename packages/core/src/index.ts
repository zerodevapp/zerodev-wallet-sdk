export type {
  // Auth types
  AuthenticateWithEmailParameters,
  AuthenticateWithEmailReturnType,
  AuthenticateWithOAuthParameters,
  AuthenticateWithOAuthReturnType,
  EmailCustomization,
  // Wallet types
  GetUserWalletParameters,
  GetUserWalletReturnType,
  GetWhoamiParameters,
  GetWhoamiReturnType,
  SignRawPayloadParameters,
  SignRawPayloadReturnType,
  SignTransactionParameters,
  SignTransactionReturnType,
} from './actions/index.js'

// Actions
export {
  // Auth actions
  authenticateWithEmail,
  authenticateWithOAuth,
  // Wallet actions
  getUserWallet,
  getWhoami,
  signRawPayload,
  signTransaction,
} from './actions/index.js'
export type { ToViemAccountParams } from './adapters/viem.js'
// Adapters
export { toViemAccount } from './adapters/viem.js'
export type { DoorwayActions } from './client/decorators/doorway.js'
// Client decorators
export { doorwayActions } from './client/decorators/doorway.js'
export type { Client, ClientConfig, Transport } from './client/index.js'
// Client
export {
  createBaseClient,
  createClient,
  type DoorwayClient,
  doorwayTransport,
} from './client/index.js'
export type {
  AuthParams,
  DoorwayConfig,
  DoorwaySDK,
} from './core/createDoorway.js'
// Core
export { createDoorway } from './core/createDoorway.js'
// Storage
export type { StorageAdapter, StorageManager } from './storage/manager.js'
// Session types
export type { DoorwaySession, StamperType } from './types/session.js'
