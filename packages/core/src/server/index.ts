// Server entry: for a Node process holding an agent key. The root entry is
// the browser surface and deliberately exports none of this.
export type {
  CreateServerWalletParameters,
  CreateServerWalletReturnType,
  SignMessageParameters,
  SignMessageReturnType,
  SignTransactionParameters,
  SignTransactionReturnType,
  SignTypedDataV4Parameters,
  SignTypedDataV4ReturnType,
} from '../actions/serverWallet/index.js'
export { type ToViemAccountParams, toViemAccount } from '../adapters/viem.js'
export {
  createServerWalletClient,
  type ServerWalletClient,
  type ServerWalletClientConfig,
} from '../client/createServerWalletClient.js'
export type { ServerWalletActions } from '../client/decorators/serverWallet.js'
export { createPrivateKeyStamper } from '../stampers/privateKeyStamper.js'
export type { SigningStamper } from '../stampers/types.js'
export {
  generateP256KeyPair,
  type P256KeyPair,
} from '../utils/p256KeyPair.js'
export {
  createZeroDevServerWallet,
  type ZeroDevServerWallet,
  type ZeroDevServerWalletConfig,
} from './createZeroDevServerWallet.js'
