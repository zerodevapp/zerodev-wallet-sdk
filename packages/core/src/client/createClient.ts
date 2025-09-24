import type { Client, ClientConfig } from "./types.js";

/**
 * Creates a Doorway client.
 * The client provides the foundation for making API requests and can be
 * extended with actions via the extend method.
 */
export function createClient<extended extends Record<string, unknown> | undefined = undefined>(
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

  const client = {
    transport: transportInstance,
    request,
    stamper,
    organizationId,
    key,
    name,
    type: "doorway",
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

/**
 * Convenience function for creating a client with doorway transport
 */
export { doorwayTransport } from "./transports/createTransport.js";