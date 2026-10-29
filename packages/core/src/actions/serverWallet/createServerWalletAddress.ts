import { canonicalizeEx } from 'json-canonicalize'
import type { Hex } from 'viem'
import type { Client } from '../../client/types.js'
import { AGENT_STAMP_HEADER, TURNKEY_STAMP_HEADER } from '../../constants.js'
import type { SigningStamper } from '../../stampers/types.js'
import { resolveOrganizationId } from './resolveOrganizationId.js'

export type CreateServerWalletAddressParameters = {
  /** The project ID for the request */
  projectId: string
  /** The wallet set's sub-organization ID. Defaults to the client's `organizationId`. */
  organizationId?: string
  /** The wallet to add the address to, as returned by `createServerWallet` */
  walletId: string
  /** BIP-32 path of the new address, `m/44'/60'/0'/0/<n>`. The wallet's first address is `<n>` 0. */
  path: string
}

export type CreateServerWalletAddressReturnType = {
  walletId: string
  /** Turnkey's id for the wallet account */
  turnkeyId: string
  path: string
  walletAddress: Hex
}

// The only path shape the KMS accepts; checked before stamping so a typo
// fails without a round trip.
const ETHEREUM_PATH = /^m\/44'\/60'\/0'\/0\/(0|[1-9][0-9]*)$/

/**
 * Turnkey CREATE_WALLET_ACCOUNTS activity, byte-for-byte what the KMS rebuilds
 * from the request (`ext/turnkey/create_user.go` CreateWalletAccountsPayload).
 * The KMS relays the agent's stamp over it and co-signs with its own key.
 */
function createWalletAccountsPayload(
  organizationId: string,
  walletId: string,
  path: string,
  timestampMs: number,
) {
  return {
    organizationId,
    parameters: {
      accounts: [
        {
          addressFormat: 'ADDRESS_FORMAT_ETHEREUM',
          curve: 'CURVE_SECP256K1',
          path,
          pathFormat: 'PATH_FORMAT_BIP32',
        },
      ],
      walletId,
    },
    timestampMs: String(timestampMs),
    type: 'ACTIVITY_TYPE_CREATE_WALLET_ACCOUNTS',
  }
}

/**
 * Adds an address to a wallet of the agent's wallet set. Requires the `create`
 * role. The KMS rejects a path already used on the wallet with 409.
 */
export async function createServerWalletAddress(
  client: Client<undefined, SigningStamper>,
  params: CreateServerWalletAddressParameters,
): Promise<CreateServerWalletAddressReturnType> {
  const { projectId, walletId, path } = params
  const organizationId = resolveOrganizationId(
    client,
    params,
    'createServerWalletAddress',
  )
  if (!ETHEREUM_PATH.test(path)) {
    throw new Error(
      `createServerWalletAddress: path must be of the form m/44'/60'/0'/0/<n>, got ${path}`,
    )
  }

  const timestampMs = Date.now()

  const innerStamp = await client.apiKeyStamper.stamp(
    canonicalizeEx(
      createWalletAccountsPayload(organizationId, walletId, path, timestampMs),
    ),
  )

  const body = {
    walletId,
    path,
    timestamp: new Date(timestampMs).toISOString(),
    stamp: {
      stampHeaderName: TURNKEY_STAMP_HEADER,
      stampHeaderValue: innerStamp.stampHeaderValue,
    },
  }
  const outerStamp = await client.apiKeyStamper.stamp(canonicalizeEx(body))

  return client.request({
    path: `${projectId}/server-wallet/wallet-addresses`,
    method: 'POST',
    body,
    headers: { [AGENT_STAMP_HEADER]: outerStamp.stampHeaderValue },
  })
}
