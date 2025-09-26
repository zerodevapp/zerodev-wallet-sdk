import type { Client, ClientConfig } from "./types.js";
import { doorwayActions, type DoorwayActions } from "./decorators/doorway.js";

let clientId = 0;

/**
 * Creates a base Doorway client.
 * This is the foundation client without any pre-loaded actions.
 * Use createClient() for a client with Doorway actions pre-loaded.
 */
export function createBaseClient<extended extends Record<string, unknown> | undefined = undefined>(
  config: ClientConfig
): Client<extended> {
  const {
    transport,
    stamper,
    organizationId,
    key = "doorway",
    name = "Doorway Client",
  } = config;

  // Initialize the transport with stamper
  const { config: transportConfig, request, value } = transport({
    stamper,
  });
  const transportInstance = { ...transportConfig, ...value };

  const uid = `${key}-${++clientId}`;

  const client = {
    transport: transportInstance,
    request,
    stamper,
    organizationId,
    key,
    name,
    type: "doorway",
    uid,
  } as const;

  function extend(base: typeof client) {
    type ExtendFn = (base: typeof client) => Record<string, unknown>;
    return (extendFn: ExtendFn) => {
      const extended = extendFn(base) as Record<string, unknown>;
      
      // Remove base properties from extended to avoid conflicts
      for (const key in client) {
        delete extended[key];
      }
      
      // Combine base client with extensions
      const combined = { ...base, ...extended };
      
      // Return new client with updated extend function
      return Object.assign(combined, { extend: extend(combined as any) });
    };
  }

  return Object.assign(client, { extend: extend(client) as any }) as Client<extended>;
}

export type DoorwayClient = Client<DoorwayActions>;

/**
 * Creates a Doorway client with Doorway actions pre-loaded.
 * This is equivalent to calling createBaseClient(config).extend(doorwayActions).
 *
 * For a client without pre-loaded actions, use createBaseClient().
 */
export function createClient(config: ClientConfig): DoorwayClient {
  const { key = "doorway", name = "Doorway Client" } = config;
  const client = createBaseClient({
    ...config,
    key,
    name,
  });
  return client.extend(doorwayActions) as DoorwayClient;
}

/**
 * Convenience function for creating a client with doorway transport
 */
export { doorwayTransport } from "./transports/createTransport.js";