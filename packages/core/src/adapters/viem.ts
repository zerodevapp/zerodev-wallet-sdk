import {
  hashMessage,
  type Hex,
  type LocalAccount,
  type SignableMessage,
  zeroAddress,
  parseSignature,
} from "viem";
import { toAccount } from "viem/accounts";
import { hashAuthorization } from "viem/utils";
import type {
  Address,
  SignAuthorizationParameters,
  SignAuthorizationReturnType,
} from "viem/accounts";
import { DoorwayClient } from "../client/DoorwayClient.js";

export interface ToViemAccountParams {
  client: DoorwayClient;
  organizationId: string;
}

export async function toViemAccount(
  params: ToViemAccountParams
): Promise<LocalAccount> {
  const { client, organizationId } = params;

  let address: Hex = zeroAddress;

  try {
    const walletResponse = await client.requestProxy("user-wallet", {
      organizationId,
    })
    address = walletResponse.walletAddress;
  } catch {
    address = zeroAddress;
  }
  const signRawPayload = async (messageHash: Hex) => {
    const stampResponse = await client.stampSignRawPayload({
      type: "ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2",
      timestampMs: new Date().getTime().toString(),
      organizationId,
      parameters: {
        signWith: address,
        payload: messageHash.replace(/^0x/, ""),
        encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
        hashFunction: "HASH_FUNCTION_NO_OP",
      },
    });

    const data = await client.requestProxy("sign/raw-payload", {
      body: stampResponse?.body,
      stamp: stampResponse?.stamp,
      apiUrl: stampResponse?.url,
      operationType: "raw_payload",
    });

    return data.signature;
  };

  return toAccount({
    address,

    async signMessage({ message }: { message: SignableMessage }): Promise<Hex> {
      const hashedMessage = hashMessage(message);
      return signRawPayload(hashedMessage);
    },

    signTransaction: async () => {
      throw new Error("Not implemented");
    },
    signTypedData: async () => {
      throw new Error("Not implemented");
    },

    async signAuthorization(
      parameters: Omit<SignAuthorizationParameters, "privateKey">
    ): Promise<SignAuthorizationReturnType> {
      const { chainId, nonce } = parameters;
      const authAddress = parameters.contractAddress ?? parameters.address;

      if (!authAddress) {
        throw new Error("Unable to sign authorization: address is undefined");
      }

      const hashedAuthorization = hashAuthorization({
        address: authAddress,
        chainId,
        nonce,
      });

      const signature = await signRawPayload(hashedAuthorization);

      const parsedSignature = parseSignature(signature);

      return {
        address: authAddress,
        chainId,
        nonce,
        ...parsedSignature,
        yParity: parsedSignature.v === BigInt(27) ? 0 : 1,
      } as SignAuthorizationReturnType;
    },
  });
}
