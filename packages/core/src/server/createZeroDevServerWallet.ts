import type { Hex, LocalAccount } from 'viem'
import type {
  CreateServerWalletAddressReturnType,
  CreateServerWalletReturnType,
} from '../actions/serverWallet/index.js'
import { toViemAccount } from '../adapters/viem.js'
import {
  createServerWalletClient,
  type ServerWalletClient,
  type ServerWalletClientConfig,
} from '../client/createServerWalletClient.js'

export type ZeroDevServerWalletConfig = ServerWalletClientConfig & {
  /** The project ID for every request */
  projectId: string
}

export type ZeroDevServerWallet = {
  /** The underlying client, for the raw actions the account is built on. */
  client: ServerWalletClient
  /** Creates a wallet in the wallet set. Role: `create`. */
  createWallet: () => Promise<CreateServerWalletReturnType>
  /**
   * Adds an address to one of the set's wallets at `path`, of the form
   * `m/44'/60'/0'/0/<n>`; the wallet's first address is `<n>` 0. Role: `create`.
   */
  createAddress: (params: {
    walletId: string
    path: string
  }) => Promise<CreateServerWalletAddressReturnType>
  /**
   * A viem `LocalAccount` for one wallet of the set. Pass it to viem, or to
   * Kernel as the signer in 4337 or 7702 mode.
   */
  toAccount: (params: { address: Hex }) => Promise<LocalAccount>
}

/**
 * The server counterpart of `createZeroDevWallet`: a process holding an agent
 * key, with no session and no storage. Builds the server wallet client and
 * binds the project to it.
 */
export function createZeroDevServerWallet(
  config: ZeroDevServerWalletConfig,
): ZeroDevServerWallet {
  const { projectId, organizationId } = config
  const client = createServerWalletClient(config)
  return {
    client,
    createWallet: () => client.createServerWallet({ projectId }),
    createAddress: ({ walletId, path }) =>
      client.createServerWalletAddress({ projectId, walletId, path }),
    toAccount: ({ address }) =>
      toViemAccount({ client, organizationId, projectId, address }),
  }
}
