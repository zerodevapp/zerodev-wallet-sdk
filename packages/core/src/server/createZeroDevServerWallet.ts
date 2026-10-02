import type { Hex, LocalAccount } from 'viem'
import type { CreateServerWalletReturnType } from '../actions/serverWallet/index.js'
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
  /** The project every request is made for. */
  projectId: string
  /** The underlying client, for the raw actions the account is built on. */
  client: ServerWalletClient
  /** Creates a wallet in the wallet set. Role: `create`. */
  createWallet: () => Promise<CreateServerWalletReturnType>
  /**
   * A viem `LocalAccount` for one wallet of the set. Pass it to viem or to a
   * Kernel validator as the signer. Its `signAuthorization` throws: the KMS
   * has no agent route for EIP-7702.
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
    projectId,
    client,
    createWallet: () => client.createServerWallet({ projectId }),
    toAccount: ({ address }) =>
      toViemAccount({ client, organizationId, projectId, address }),
  }
}
