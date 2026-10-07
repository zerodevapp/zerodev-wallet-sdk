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
  /** Extra options merged into every fetch() call */
  fetchOptions?: Omit<RequestInit, 'body' | 'method' | 'signal'>
  /**
   * @internal The package reported in the `X-SDK-Version` header. Wrapper
   * packages set their own name and version; apps should not set it.
   */
  sdkVersion?: string
}

/**
 * Creates a transport for the ZeroDev Wallet client.
 * Requires a stamper for authenticated requests.
 */
export function zeroDevWalletTransport(
  options: CreateTransportOptions,
): Transport {
  const {
    baseUrl,
    timeoutMs = 10_000,
    key = 'zeroDevWallet',
    name = 'ZeroDev Wallet Transport',
  } = options

  return ({ apiKeyStamper, passkeyStamper }) => {
    // Create REST transport with stamper
    const transport = rest(baseUrl, {
      timeoutMs,
      key,
      name,
      apiKeyStamper,
      passkeyStamper,
      ...(options.fetchOptions && { fetchOptions: options.fetchOptions }),
      ...(options.sdkVersion && { sdkVersion: options.sdkVersion }),
    })

    return {
      config: {
        name,
        key,
        url: baseUrl,
        timeoutMs,
        type: 'zeroDevWallet',
      },
      request: transport.request,
      value: {
        apiKeyStamper,
        passkeyStamper,
      },
    }
  }
}
