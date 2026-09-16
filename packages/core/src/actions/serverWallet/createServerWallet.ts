import { canonicalizeEx } from 'json-canonicalize'
import type { Hex } from 'viem'
import type { Client } from '../../client/types.js'
import { TURNKEY_STAMP_HEADER } from '../../constants.js'
import type { SigningStamper } from '../../stampers/types.js'

export type CreateServerWalletParameters = {
  /** The project ID for the request */
  projectId: string
  /** The wallet set's sub-organization ID. Defaults to the client's `organizationId`. */
  organizationId?: string
}

export type CreateServerWalletReturnType = {
  walletId: string
  walletAddress: Hex
}

/**
 * Turnkey CREATE_WALLET activity, byte-for-byte what the KMS rebuilds from the
 * request (`ext/turnkey/create_user.go` CreateWalletPayload). The KMS relays the
 * agent's stamp over it and co-signs with its own key.
 */
function createWalletPayload(organizationId: string, timestampMs: number) {
  return {
    organizationId,
    parameters: {
      accounts: [
        {
          addressFormat: 'ADDRESS_FORMAT_ETHEREUM',
          curve: 'CURVE_SECP256K1',
          path: "m/44'/60'/0'/0/0",
          pathFormat: 'PATH_FORMAT_BIP32',
        },
      ],
      walletName: `default wallet-${timestampMs}`,
    },
    timestampMs: String(timestampMs),
    type: 'ACTIVITY_TYPE_CREATE_WALLET',
  }
}

/**
 * Creates a wallet in the agent's wallet set. Requires the `create` role.
 */
export async function createServerWallet(
  client: Client<undefined, SigningStamper>,
  params: CreateServerWalletParameters,
): Promise<CreateServerWalletReturnType> {
  const organizationId = params.organizationId ?? client.organizationId
  if (!organizationId) {
    throw new Error(
      'createServerWallet needs an organizationId: pass it in params or on the client.',
    )
  }
  const timestampMs = Date.now()

  const innerStamp = await client.apiKeyStamper.stamp(
    canonicalizeEx(createWalletPayload(organizationId, timestampMs)),
  )
  const body = {
    timestampMs,
    stamp: {
      stampHeaderName: TURNKEY_STAMP_HEADER,
      stampHeaderValue: innerStamp.stampHeaderValue,
    },
  }
  const outerStamp = await client.apiKeyStamper.stamp(canonicalizeEx(body))

  return client.request({
    path: `${params.projectId}/server-wallet/wallets`,
    method: 'POST',
    body,
    headers: { [outerStamp.stampHeaderName]: outerStamp.stampHeaderValue },
  })
}
