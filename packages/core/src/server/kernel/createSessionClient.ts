import type { ModularSigner } from '@zerodev/permissions'
import { deserializePermissionAccount } from '@zerodev/permissions'
import { toECDSASigner } from '@zerodev/permissions/signers'
import {
  createKernelAccountClient,
  createZeroDevPaymasterClient,
  type KernelAccountClient,
} from '@zerodev/sdk'
import { getEntryPoint, KERNEL_V3_3 } from '@zerodev/sdk/constants'
import {
  type Address,
  type Chain,
  createPublicClient,
  type HttpTransportConfig,
  http,
  type PublicClient,
} from 'viem'
import type { ZeroDevServerWallet } from '../createZeroDevServerWallet.js'
import { parsePermissionError } from './errors.js'

const ZERODEV_AA_HOST = 'https://rpc.zerodev.app'

// ponytail: mirrors wallet-react's getAAUrl; move both to one shared helper
// when a third caller appears.
export function getZeroDevAAUrl(params: {
  projectId: string
  chainId: number
  aaHost?: string | undefined
}) {
  const host = (params.aaHost ?? ZERODEV_AA_HOST).replace(/\/+$/, '')
  return `${host}/api/v3/${params.projectId}/chain/${params.chainId}?provider=ULTRA_RELAY`
}

/**
 * The permission plugin signer for one of the wallet set's wallets. The
 * session key is the server wallet: it signs the user-operation hash through
 * KMS (`server-wallet/sign/message`), and its private key never leaves Turnkey.
 */
export async function toSessionSigner(
  wallet: ZeroDevServerWallet,
  params: { address: Address },
): Promise<ModularSigner> {
  return toECDSASigner({ signer: await wallet.toAccount(params) })
}

export type CreateSessionClientParameters = {
  wallet: ZeroDevServerWallet
  /** The server wallet the user granted the permission to. */
  address: Address
  /** The `permissionsContext` returned by `grantPermissions` on the user's side. */
  permissionsContext: string
  chain: Chain
  /** Reads chain state. Defaults to the chain's public RPC. */
  publicClient?: PublicClient
  /** ZeroDev bundler/paymaster host. Defaults to production. */
  aaHost?: string
  /**
   * Extra fetch options for bundler and paymaster calls, such as an `Origin`
   * header on the project's allowlist. Server requests carry no browser origin.
   */
  fetchOptions?: HttpTransportConfig['fetchOptions']
}

export type SessionClient = KernelAccountClient & {
  /** The user's smart account this client acts on. */
  address: Address
  /** Same as `sendUserOperation`, with permission failures mapped to typed errors. */
  sendCalls: (
    calls: { to: Address; value?: bigint; data?: `0x${string}` }[],
  ) => Promise<{ userOpHash: `0x${string}`; transactionHash: `0x${string}` }>
}

/**
 * A Kernel client that acts on the user's smart account inside the limits the
 * user granted to this server wallet. Gas is sponsored by the project's
 * ZeroDev paymaster. The permission installs itself in the first user
 * operation, so there is no setup transaction.
 */
export async function createSessionClient(
  params: CreateSessionClientParameters,
): Promise<SessionClient> {
  const { wallet, address, permissionsContext, chain } = params
  const publicClient =
    params.publicClient ?? createPublicClient({ chain, transport: http() })
  const aaUrl = getZeroDevAAUrl({
    projectId: wallet.projectId,
    chainId: chain.id,
    aaHost: params.aaHost,
  })
  const transportConfig = params.fetchOptions
    ? { fetchOptions: params.fetchOptions }
    : {}

  const account = await deserializePermissionAccount(
    publicClient,
    getEntryPoint('0.7'),
    KERNEL_V3_3,
    permissionsContext,
    await toSessionSigner(wallet, { address }),
  )

  const client = createKernelAccountClient({
    account,
    chain,
    client: publicClient,
    bundlerTransport: http(aaUrl, transportConfig),
    paymaster: createZeroDevPaymasterClient({
      chain,
      transport: http(aaUrl, transportConfig),
    }),
  }) as KernelAccountClient

  return Object.assign(client, {
    address: account.address,
    async sendCalls(
      calls: { to: Address; value?: bigint; data?: `0x${string}` }[],
    ) {
      try {
        const userOpHash = await client.sendUserOperation({
          callData: await account.encodeCalls(
            calls.map((c) => ({
              to: c.to,
              value: c.value ?? 0n,
              data: c.data ?? '0x',
            })),
          ),
        })
        const { receipt } = await client.waitForUserOperationReceipt({
          hash: userOpHash,
        })
        return { userOpHash, transactionHash: receipt.transactionHash }
      } catch (error) {
        throw parsePermissionError(error)
      }
    },
  })
}
