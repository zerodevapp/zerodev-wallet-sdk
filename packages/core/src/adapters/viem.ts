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
  SignAuthorizationParameters,
  SignAuthorizationReturnType,
} from "viem/accounts";
import type { DoorwayClient } from "../client/index.js";

export interface ToViemAccountParams {
  client: DoorwayClient;
  organizationId: string;
  projectId: string;
}

export async function toViemAccount(
  params: ToViemAccountParams
): Promise<LocalAccount> {
  const { client, organizationId, projectId } = params;

  let address: Hex = zeroAddress;

  try {
    const walletResponse = await client.getUserWallet({
      organizationId,
      projectId,
    });
    address = walletResponse.walletAddress;
  } catch {
    address = zeroAddress;
  }
  const signRawPayloadInternal = async (messageHash: Hex) => {
    const result = await client.signRawPayload({
      organizationId,
      projectId,
      address,
      payload: messageHash.replace(/^0x/, ""),
    });

    return result.signature;
  };

  return toAccount({
    address,

    async signMessage({ message }: { message: SignableMessage }): Promise<Hex> {
      const hashedMessage = hashMessage(message);
      return signRawPayloadInternal(hashedMessage);
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

      const signature = await signRawPayloadInternal(hashedAuthorization);

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
