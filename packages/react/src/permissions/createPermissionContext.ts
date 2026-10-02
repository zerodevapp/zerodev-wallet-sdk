import { signerToEcdsaValidator } from '@zerodev/ecdsa-validator'
import {
  serializePermissionAccount,
  toPermissionValidator,
} from '@zerodev/permissions'
import { toEmptyECDSASigner } from '@zerodev/permissions/signers'
import {
  createKernelAccount,
  type KernelSmartAccountImplementation,
} from '@zerodev/sdk'
import { getEntryPoint, KERNEL_V3_3 } from '@zerodev/sdk/constants'
import type { Address, Hex, LocalAccount } from 'viem'
import { readCurrentNonce } from './grantStatus.js'
import { decodePermissionContext } from './revokePermission.js'
import { toPolicies } from './toPolicies.js'
import type { GrantPermissionsParameters } from './types.js'

/**
 * Builds the user's Kernel account with the requested permission as a regular
 * plugin and serializes it. The owner signs the enable data (and the 7702
 * authorization when the EOA is not delegated yet); nothing goes on-chain.
 *
 * The session key is referenced by address only, so no private key is created
 * or included: its holder supplies its own signer when it deserializes.
 */
export async function createPermissionContext(args: {
  /** Reads chain state; the connector's Kernel account client for the chain. */
  client: KernelSmartAccountImplementation['client']
  owner: LocalAccount
  mode: '7702' | '4337'
  params: GrantPermissionsParameters
}): Promise<{
  permissionsContext: string
  account: Address
  permissionId: Hex
  enableNonce: number
}> {
  const { client, owner, mode, params } = args
  const entryPoint = getEntryPoint('0.7')
  const permission = await toPermissionValidator(client, {
    entryPoint,
    kernelVersion: KERNEL_V3_3,
    signer: toEmptyECDSASigner(params.signer),
    policies: toPolicies(params),
  })

  // Same account the connector uses, with the permission as a regular plugin.
  const account = await createKernelAccount(client, {
    entryPoint,
    kernelVersion: KERNEL_V3_3,
    ...(mode === '7702'
      ? { eip7702Account: owner, plugins: { regular: permission } }
      : {
          plugins: {
            sudo: await signerToEcdsaValidator(client, {
              signer: owner,
              entryPoint,
              kernelVersion: KERNEL_V3_3,
            }),
            regular: permission,
          },
        }),
  })

  // The enable signature is made at the account's current Kernel nonce.
  const enableNonce = await readCurrentNonce(client, account.address)
  const permissionsContext = await serializePermissionAccount(account)
  return {
    permissionsContext,
    account: account.address,
    permissionId: decodePermissionContext(permissionsContext).permissionId,
    enableNonce,
  }
}
