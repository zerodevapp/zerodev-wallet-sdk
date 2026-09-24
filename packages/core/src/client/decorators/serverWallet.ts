import {
  type CreateServerWalletParameters,
  type CreateServerWalletReturnType,
  createServerWallet,
  type SignMessageParameters,
  type SignMessageReturnType,
  type SignTransactionParameters,
  type SignTransactionReturnType,
  type SignTypedDataV4Parameters,
  type SignTypedDataV4ReturnType,
  type SignUserOperationParameters,
  type SignUserOperationReturnType,
  signMessage,
  signTransaction,
  signTypedDataV4,
  signUserOperation,
} from '../../actions/serverWallet/index.js'
import type { SigningStamper } from '../../stampers/types.js'
import type { Client } from '../types.js'

/**
 * Everything an agent key can do against a wallet set. The KMS checks the
 * key's roles (`create`, `sign`) per route; the client binds all five and
 * lets a 403 report a missing role.
 */
export type ServerWalletActions = {
  /** Creates a wallet in the wallet set. Role: `create`. */
  createServerWallet: (
    params: CreateServerWalletParameters,
  ) => Promise<CreateServerWalletReturnType>

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

  /** Signs a user operation. Role: `sign`. */
  signUserOperation: (
    params: SignUserOperationParameters,
  ) => Promise<SignUserOperationReturnType>
}

export function serverWalletActions(
  client: Client<undefined, SigningStamper>,
): ServerWalletActions {
  return {
    createServerWallet: (params) => createServerWallet(client, params),
    signMessage: (params) => signMessage(client, params),
    signTransaction: (params) => signTransaction(client, params),
    signTypedDataV4: (params) => signTypedDataV4(client, params),
    signUserOperation: (params) => signUserOperation(client, params),
  }
}
