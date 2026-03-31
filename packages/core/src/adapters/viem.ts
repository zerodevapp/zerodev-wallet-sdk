import {
  bytesToHex,
  concat,
  getTypesForEIP712Domain,
  type Hex,
  hashTypedData,
  type LocalAccount,
  numberToHex,
  parseSignature,
  type SerializeTransactionFn,
  type SignableMessage,
  serializeTransaction,
  serializeTypedData,
  type TransactionSerializable,
  toRlp,
  zeroAddress,
} from 'viem'
import type {
  SignAuthorizationParameters,
  SignAuthorizationReturnType,
} from 'viem/accounts'
import { toAccount } from 'viem/accounts'
import { hashAuthorization } from 'viem/utils'
import type { ZeroDevWalletClient } from '../client/index.js'

export interface ToViemAccountParams {
  client: ZeroDevWalletClient
  organizationId: string
  projectId: string
  getToken: () => string | Promise<string>
}

export async function toViemAccount(
  params: ToViemAccountParams,
): Promise<LocalAccount> {
  const { client, organizationId, projectId, getToken } = params

  let address: Hex = zeroAddress

  try {
    const walletResponse = await client.getUserWallet({
      organizationId,
      projectId,
      token: await getToken(),
    })
    address = walletResponse.walletAddresses[0]
  } catch {
    address = zeroAddress
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

    const serializedTx = await serializer(signableTransaction)
    const nonHexPrefixedSerializedTx = serializedTx.replace(/^0x/, '')
    const signature = await client.signTransaction({
      organizationId,
      projectId,
      token: await getToken(),
      address,
      unsignedTransaction: nonHexPrefixedSerializedTx,
    })

    const { r, s, v, yParity } = parseSignature(signature)
    return serializeTransaction(transaction, { r, s, v, yParity })
  }

  return toAccount({
    address,

    async signMessage({ message }: { message: SignableMessage }): Promise<Hex> {
      if (typeof message === 'string') {
        return client.signMessage({
          organizationId,
          projectId,
          token: await getToken(),
          address,
          message,
          encoding: 'utf8',
        })
      }
      // Raw message (Hex or ByteArray)
      const raw =
        typeof message.raw === 'string'
          ? message.raw.replace(/^0x/, '')
          : bytesToHex(message.raw).slice(2)
      return client.signMessage({
        organizationId,
        projectId,
        token: await getToken(),
        address,
        message: raw,
        encoding: 'hex',
      })
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
      const serializedTypedData = serializeTypedData({
        ...typedData,
        types: {
          ...typedData.types,
          EIP712Domain: getTypesForEIP712Domain({
            domain: typedData.domain as Parameters<
              typeof getTypesForEIP712Domain
            >[0]['domain'],
          }),
        },
      } as Parameters<typeof serializeTypedData>[0])
      return client.signTypedDataV4({
        organizationId,
        projectId,
        token: await getToken(),
        address,
        unsignedTypedDataV4: serializedTypedData,
        encoding: 'utf8',
        typedDataHash: hashTypedData(
          typedData as Parameters<typeof hashTypedData>[0],
        ).slice(2),
      })
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

      // Serialize EIP-7702 authorization: 0x05 || RLP([chainId, address, nonce])
      const unsignedTransaction = concat([
        '0x05',
        toRlp([
          chainId ? numberToHex(chainId) : '0x',
          authAddress,
          nonce ? numberToHex(nonce) : '0x',
        ]),
      ]).slice(2)

      const signature = await client.sign7702Authorization({
        organizationId,
        projectId,
        token: await getToken(),
        address,
        unsignedTransaction,
        hashedAuthorization: hashedAuthorization.slice(2),
      })

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
