import type { Stamper } from '../stampers/types.js'
import type { RestRequestFn } from './transports/rest.js'

export type TransportConfig = {
  /** The name of the transport. */
  name: string
  /** The key of the transport. */
  key: string
  /** Base URL for the API */
  url: string
  /** Proxy base URL for auth requests */
  proxyBaseUrl?: string
  /** Request timeout in milliseconds */
  timeoutMs: number
  /** The type of the transport. */
  type: string
}

export type Transport = (options: { stamper: Stamper }) => {
  config: TransportConfig
  request: RestRequestFn
  value?: Record<string, unknown>
}

export type ClientConfig = {
  /** Transport for the client */
  transport: Transport
  /** Stamper for authenticated requests */
  stamper: Stamper
  /** Organization ID */
  organizationId?: string
  /** A key for the client. */
  key?: string
  /** A name for the client. */
  name?: string
}

export type Client<extended extends Extended | undefined = undefined> = {
  /** Transport configuration */
  transport: TransportConfig & Record<string, unknown>
  /** Request function from transport */
  request: RestRequestFn
  /** Stamper for authenticated requests */
  stamper: Stamper
  /** Organization ID */
  organizationId?: string
  /** A key for the client */
  key: string
  /** A name for the client */
  name: string
  /** The type of client */
  type: string
  /** A unique ID for the client */
  uid: string
  /** Extend the client with additional functionality */
  extend: <const client extends Extended>(
    fn: (client: Client<extended>) => client,
  ) => Client<client & (extended extends Extended ? extended : unknown)>
} & (extended extends Extended ? extended : unknown)

type Extended = {
  [key: string]: unknown
}
