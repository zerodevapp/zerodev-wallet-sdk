import type { Transport } from '../types.js'
import { rest } from './rest.js'

export type CreateTransportOptions = {
  /** Base URL for the API */
  baseUrl: string
  /** Request timeout in milliseconds */
  timeoutMs?: number
  /** Transport key identifier */
  key?: string
  /** Transport name */
  name?: string
}

/**
 * Creates a transport for the ZeroDev Signer client.
 * Requires a stamper for authenticated requests.
 */
export function zeroDevSignerTransport(
  options: CreateTransportOptions,
): Transport {
  const {
    baseUrl,
    timeoutMs = 10_000,
    key = 'zeroDevSigner',
    name = 'ZeroDev Signer Transport',
  } = options

  return ({ stamper }) => {
    // Create REST transport with stamper
    const transport = rest(baseUrl, {
      timeoutMs,
      key,
      name,
      stamper,
    })

    return {
      config: {
        name,
        key,
        url: baseUrl,
        timeoutMs,
        type: 'zeroDevSigner',
      },
      request: transport.request,
      value: {
        stamper,
      },
    }
  }
}
