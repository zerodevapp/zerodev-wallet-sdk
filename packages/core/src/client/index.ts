export {
  type AuthProxyClient,
  type AuthProxyClientConfig,
  type AuthProxyVerifyOtpRequest,
  type AuthProxyVerifyOtpResponse,
  createAuthProxyClient,
} from './authProxy.js'
export {
  createBaseClient,
  createClient,
  type ZeroDevWalletClient,
} from './createClient.js'
export { zeroDevWalletTransport } from './transports/createTransport.js'
export type {
  Client,
  ClientConfig,
  Transport,
  TransportConfig,
} from './types.js'
