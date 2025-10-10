import {
  type Hex,
  hashMessage,
  type LocalAccount,
  parseSignature,
  parseTransaction,
  type SerializeTransactionFn,
  type SignableMessage,
  serializeTransaction,
  serializeTypedData,
  type TransactionSerializable,
  zeroAddress,
} from 'viem'
import type {
  SignAuthorizationParameters,
  SignAuthorizationReturnType,
} from 'viem/accounts'
import { toAccount } from 'viem/accounts'
import { hashAuthorization } from 'viem/utils'
import type { signRawPayload } from '../actions/index.js'
import type { ZeroDevSignerClient } from '../client/index.js'

export interface ToViemAccountParams {
  client: ZeroDevSignerClient
  organizationId: string
  projectId: string
}

export async function toViemAccount(
  params: ToViemAccountParams,
): Promise<LocalAccount> {
  const { client, organizationId, projectId } = params

  let address: Hex = zeroAddress

  try {
    const walletResponse = await client.getUserWallet({
      organizationId,
      projectId,
    })
    address = walletResponse.walletAddress
  } catch {
    address = zeroAddress
  }
  const signRawPayloadInternal = async (
    payload: string,
    encoding: Parameters<
      typeof signRawPayload
    >[1]['encoding'] = 'PAYLOAD_ENCODING_HEXADECIMAL',
  ) => {
    return await client.signRawPayload({
      organizationId,
      projectId,
      address,
      payload,
      encoding,
    })
  }

  // Modified from: https://github.com/tkhq/sdk/blob/4e439bf2973ea13b51d981d7c24a4841d4e5fd5f/packages/viem/src/index.ts#L419-L461
  const signTransactionInternal = async <
    TTransactionSerializable extends TransactionSerializable,
  >(
    transaction: TTransactionSerializable,
    serializer: SerializeTransactionFn<TTransactionSerializable>,
  ): Promise<Hex> => {
    // Note: for Type 3 transactions, we are specifically handling parsing for payloads containing only the transaction payload body, without any wrappers around blobs, commitments, or proofs.
    // See more: https://github.com/wevm/viem/blob/3ef19eac4963014fb20124d1e46d1715bed5509f/src/accounts/utils/signTransaction.ts#L54-L55
    const signableTransaction =
      transaction.type === 'eip4844'
        ? { ...transaction, sidecars: false }
        : transaction

    const serializedTx = serializer(signableTransaction)
    const nonHexPrefixedSerializedTx = serializedTx.replace(/^0x/, '')
    const signature = await client.signTransaction({
      organizationId,
      projectId,
      address,
      unsignedTransaction: nonHexPrefixedSerializedTx,
    })

    if (transaction.type === 'eip4844') {
      // Grab components of the signature
      const { r, s, v } = parseTransaction(signature)

      // Recombine with the original transaction
      return serializeTransaction(transaction, {
        r: r!,
        s: s!,
        v: v!,
      })
    }

    return signature
  }

  return toAccount({
    address,

    async signMessage({ message }: { message: SignableMessage }): Promise<Hex> {
      const hashedMessage = hashMessage(message)
      return signRawPayloadInternal(hashedMessage)
    },

    signTransaction: async <
      TTransactionSerializable extends TransactionSerializable,
    >(
      transaction: TTransactionSerializable,
      options?: {
        serializer?:
          | SerializeTransactionFn<TTransactionSerializable>
          | undefined
      },
    ) => {
      const serializer: SerializeTransactionFn<TTransactionSerializable> =
        options?.serializer ??
        (serializeTransaction as SerializeTransactionFn<TTransactionSerializable>)
      return signTransactionInternal(transaction, serializer)
    },
    signTypedData: async (typedData) => {
      const serializedTypedData = serializeTypedData(typedData)
      return signRawPayloadInternal(
        serializedTypedData,
        'PAYLOAD_ENCODING_EIP712',
      )
    },

    async signAuthorization(
      parameters: Omit<SignAuthorizationParameters, 'privateKey'>,
    ): Promise<SignAuthorizationReturnType> {
      const { chainId, nonce } = parameters
      const authAddress = parameters.contractAddress ?? parameters.address

      if (!authAddress) {
        throw new Error('Unable to sign authorization: address is undefined')
      }

      const hashedAuthorization = hashAuthorization({
        address: authAddress,
        chainId,
        nonce,
      })

      const signature = await signRawPayloadInternal(hashedAuthorization)

      const parsedSignature = parseSignature(signature)

      return {
        address: authAddress,
        chainId,
        nonce,
        ...parsedSignature,
        yParity: parsedSignature.v === BigInt(27) ? 0 : 1,
      } as SignAuthorizationReturnType
    },
  })
}
