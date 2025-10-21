import type { Stamper } from '../stampers/types.js'
import {
  type ZeroDevWalletActions,
  zeroDevWalletActions,
} from './decorators/client.js'
import type { Client, ClientConfig } from './types.js'

let clientId = 0

/**
 * Creates a base ZeroDev Wallet client.
 * This is the foundation client without any pre-loaded actions.
 * Use createClient() for a client with ZeroDev Wallet actions pre-loaded.
 */
export function createBaseClient<
  extended extends Record<string, unknown> | undefined = undefined,
  TStamper extends Stamper = Stamper,
>(config: ClientConfig): Client<extended, TStamper> {
  const {
    transport,
    stamper,
    organizationId,
    key = 'zeroDevWallet',
    name = 'ZeroDev Wallet Client',
  } = config

  // Initialize the transport with stamper
  const {
    config: transportConfig,
    request,
    value,
  } = transport({
    stamper,
  })
  const transportInstance = { ...transportConfig, ...value }

  const uid = `${key}-${++clientId}`

  const client = {
    transport: transportInstance,
    request,
    stamper,
    organizationId,
    key,
    name,
    type: 'zeroDevWallet',
    uid,
  } as const

  function extend(base: typeof client) {
    type ExtendFn = (base: typeof client) => Record<string, unknown>
    return (extendFn: ExtendFn) => {
      const extended = extendFn(base) as Record<string, unknown>

      // Remove base properties from extended to avoid conflicts
      for (const key in client) {
        delete extended[key]
      }

      // Combine base client with extensions
      const combined = { ...base, ...extended }

      // Return new client with updated extend function
      return Object.assign(combined, { extend: extend(combined as any) })
    }
  }

  return Object.assign(client, { extend: extend(client) as any }) as Client<
    extended,
    TStamper
  >
}

export type ZeroDevWalletClient<TStamper extends Stamper = Stamper> = Client<
  ZeroDevWalletActions,
  TStamper
>

/**
 * Creates a ZeroDev Wallet client with ZeroDev Wallet actions pre-loaded.
 * This is equivalent to calling createBaseClient(config).extend(zeroDevWalletActions).
 *
 * For a client without pre-loaded actions, use createBaseClient().
 */
export function createClient<TStamper extends Stamper = Stamper>(
  config: ClientConfig<TStamper>,
): ZeroDevWalletClient<TStamper> {
  const { key = 'zeroDevWallet', name = 'ZeroDev Wallet Client' } = config
  const client = createBaseClient({
    ...config,
    key,
    name,
  })
  return client.extend(zeroDevWalletActions) as ZeroDevWalletClient<TStamper>
}
