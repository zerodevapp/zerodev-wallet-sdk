// Demo agent backed by a ZeroDev server wallet (staging). Stateless: the
// browser sends the permissionsContext it holds; this module only signs.
import { createZeroDevServerWallet } from '@zerodev/wallet-core/server'
import {
  createSessionClient,
  PermissionDeniedError,
  PermissionExpiredError,
} from '@zerodev/wallet-core/server/kernel'
import { type Address, createPublicClient, encodeFunctionData, http } from 'viem'
import { arbitrumSepolia } from 'viem/chains'
import { NFT_ABI, NFT_ADDRESS } from './spike-constants'

function env(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing env var ${name}`)
  return value
}

/** The agent's server wallet address, created once at provisioning. */
export const getAgentAddress = () => env('AGENT_ADDRESS') as Address

function serverWallet(origin: string) {
  return createZeroDevServerWallet({
    projectId: env('SERVER_WALLET_PROJECT_ID'),
    organizationId: env('SERVER_WALLET_ORG_ID'),
    privateKey: env('AGENT_PRIVATE_KEY'),
    proxyBaseUrl:
      process.env.SERVER_WALLET_KMS_URL ?? 'https://kms.staging.zerodev.app/api/v1',
    // Server requests carry no browser origin; send the app's own, which is on
    // the project's allowlist.
    fetchOptions: { headers: { Origin: origin } },
  })
}

export type ActResult =
  | { ok: true; account: Address; transactionHash: string }
  | {
      ok: false
      kind: 'denied' | 'expired'
      reason?: string
      message: string
    }

/** The agent mints the NFT to `to`, acting on the user's account within the grant. */
export async function actForUser(args: {
  permissionsContext: string
  to: Address
  origin: string
}): Promise<ActResult> {
  const session = await createSessionClient({
    wallet: serverWallet(args.origin),
    address: getAgentAddress(),
    permissionsContext: args.permissionsContext,
    chain: arbitrumSepolia,
    publicClient: createPublicClient({
      chain: arbitrumSepolia,
      transport: http(process.env.NEXT_PUBLIC_ARB_SEPOLIA_RPC_URL),
    }),
    aaHost:
      process.env.AGENT_AA_HOST ?? 'https://staging-meta-aa-provider.onrender.com',
    fetchOptions: { headers: { Origin: args.origin } },
  })

  try {
    const { transactionHash } = await session.sendCalls([
      {
        to: NFT_ADDRESS,
        data: encodeFunctionData({
          abi: NFT_ABI,
          functionName: 'mint',
          args: [args.to],
        }),
      },
    ])
    return { ok: true, account: session.address, transactionHash }
  } catch (error) {
    if (error instanceof PermissionDeniedError) {
      return { ok: false, kind: 'denied', reason: error.reason, message: error.message }
    }
    if (error instanceof PermissionExpiredError) {
      return { ok: false, kind: 'expired', message: error.message }
    }
    throw error
  }
}
