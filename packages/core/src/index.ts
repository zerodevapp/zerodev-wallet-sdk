export { createDoorway } from "./core/createDoorway.js";
export type {
  DoorwaySDK,
  DoorwayConfig,
  AuthParams,
} from "./core/createDoorway.js";


export { createClient, doorwayTransport } from "./client/index.js";
export type { Client, ClientConfig, Transport } from "./client/index.js";

export { toViemAccount } from "./adapters/viem.js";
export type { ToViemAccountParams } from "./adapters/viem.js";
