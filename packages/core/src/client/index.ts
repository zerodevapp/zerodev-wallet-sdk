export {
  type AuthProxyClient,
  type AuthProxyClientConfig,
  type AuthProxyOtpLoginRequest,
  type AuthProxyOtpLoginResponse,
  type AuthProxyVerifyOtpRequest,
  type AuthProxyVerifyOtpResponse,
  type ClientSignature,
  createAuthProxyClient,
  type OtpLoginParams,
  type SignaturePayload,
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
