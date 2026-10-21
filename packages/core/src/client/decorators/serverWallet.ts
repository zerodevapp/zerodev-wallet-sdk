import {
  type CreateServerWalletAddressParameters,
  type CreateServerWalletAddressReturnType,
  type CreateServerWalletParameters,
  type CreateServerWalletReturnType,
  createServerWallet,
  createServerWalletAddress,
  type Sign7702AuthorizationParameters,
  type Sign7702AuthorizationReturnType,
  type SignMessageParameters,
  type SignMessageReturnType,
  type SignTransactionParameters,
  type SignTransactionReturnType,
  type SignTypedDataV4Parameters,
  type SignTypedDataV4ReturnType,
  sign7702Authorization,
  signMessage,
  signTransaction,
  signTypedDataV4,
} from '../../actions/serverWallet/index.js'
import type { SigningStamper } from '../../stampers/types.js'
import type { Client } from '../types.js'

/**
 * Everything an agent key can do against a wallet set. The KMS checks the
 * key's roles (`create`, `sign`) per route; the client binds all six and
 * lets a 403 report a missing role. The sign actions are the ones the viem
 * adapter needs; a user operation is signed through the account's `signMessage`.
 */
export type ServerWalletActions = {
  /** Creates a wallet in the wallet set. Role: `create`. */
  createServerWallet: (
    params: CreateServerWalletParameters,
  ) => Promise<CreateServerWalletReturnType>

  /** Adds an address at a new BIP-32 path to a wallet of the set. Role: `create`. */
  createServerWalletAddress: (
    params: CreateServerWalletAddressParameters,
  ) => Promise<CreateServerWalletAddressReturnType>

  /** Signs a message (EIP-191). Role: `sign`. */
  signMessage: (params: SignMessageParameters) => Promise<SignMessageReturnType>

  /** Signs a transaction. Role: `sign`. */
  signTransaction: (
    params: SignTransactionParameters,
  ) => Promise<SignTransactionReturnType>

  /** Signs EIP-712 typed data. Role: `sign`. */
  signTypedDataV4: (
    params: SignTypedDataV4Parameters,
  ) => Promise<SignTypedDataV4ReturnType>

  /** Signs an EIP-7702 authorization. Role: `sign`. */
  sign7702Authorization: (
    params: Sign7702AuthorizationParameters,
  ) => Promise<Sign7702AuthorizationReturnType>
}

export function serverWalletActions(
  client: Client<undefined, SigningStamper>,
): ServerWalletActions {
  return {
    createServerWallet: (params) => createServerWallet(client, params),
    createServerWalletAddress: (params) =>
      createServerWalletAddress(client, params),
    signMessage: (params) => signMessage(client, params),
    signTransaction: (params) => signTransaction(client, params),
    signTypedDataV4: (params) => signTypedDataV4(client, params),
    sign7702Authorization: (params) => sign7702Authorization(client, params),
  }
}
