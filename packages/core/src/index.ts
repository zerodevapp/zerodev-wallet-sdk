// Core functionality
export { createDoorway } from "./core/createDoorway.js";
export type {
  DoorwaySDK,
  DoorwayConfig,
  AuthParams,
  EmailCustomization,
} from "./core/createDoorway.js";

// Client
export {
  createClient,
  createBaseClient,
  doorwayTransport,
  type DoorwayClient
} from "./client/index.js";
export type { Client, ClientConfig, Transport } from "./client/index.js";

// Client decorators
export { doorwayActions } from "./client/decorators/doorway.js";
export type { DoorwayActions } from "./client/decorators/doorway.js";

// Actions
export {
  // Auth actions
  authenticateWithEmail,
  authenticateWithOAuth,
  getWhoami,
  // Wallet actions
  getUserWallet,
  signRawPayload,
} from "./actions/index.js";

export type {
  // Auth types
  AuthenticateWithEmailParameters,
  AuthenticateWithEmailReturnType,
  AuthenticateWithOAuthParameters,
  AuthenticateWithOAuthReturnType,
  GetWhoamiParameters,
  GetWhoamiReturnType,
  // Wallet types
  GetUserWalletParameters,
  GetUserWalletReturnType,
  SignRawPayloadParameters,
  SignRawPayloadReturnType,
} from "./actions/index.js";

// Adapters
export { toViemAccount } from "./adapters/viem.js";
export type { ToViemAccountParams } from "./adapters/viem.js";
