import type { KernelAccountClient } from '@zerodev/sdk'
import {
  type Address,
  concatHex,
  encodeAbiParameters,
  encodeFunctionData,
  type Hex,
  isAddressEqual,
  pad,
  parseAbi,
  zeroAddress,
} from 'viem'
import { readContract } from 'viem/actions'

const kernelAbi = parseAbi([
  'function validationConfig(bytes21 vId) view returns ((uint32 nonce, address hook))',
  'function currentNonce() view returns (uint32)',
  'function uninstallValidation(bytes21 vId, bytes deinitData, bytes hookDeinitData)',
  'function invalidateNonce(uint32 nonce)',
])

const PERMISSION_VALIDATION_TYPE = '0x02'

/**
 * The parts of a `permissionsContext` revocation needs. The context is
 * base64 JSON written by `@zerodev/permissions`' serializePermissionAccount.
 */
// ponytail: mirrors the plugin's internal deserializePermissionAccountParams,
// which it does not export.
export function decodePermissionContext(permissionsContext: string): {
  account: Address
  permissionId: Hex
  policyCount: number
} {
  const binary = atob(permissionsContext)
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
  const params = JSON.parse(new TextDecoder().decode(bytes)) as {
    permissionParams: { permissionId: Hex; policies?: unknown[] }
    accountParams: { accountAddress: Address }
  }
  return {
    account: params.accountParams.accountAddress,
    permissionId: params.permissionParams.permissionId,
    policyCount: params.permissionParams.policies?.length ?? 0,
  }
}

/**
 * Makes a granted permission unusable, from the user's own account:
 *
 * - Installed (the session key has used it): uninstall the permission
 *   validation. Policies and signer only read the permission id on uninstall,
 *   so empty deinit data per module is enough.
 * - Not installed yet: invalidate the account's validation nonce. That voids
 *   the unused enable signature. Kernel has no narrower tool: it also voids
 *   every other unused grant AND disables every installed non-root
 *   permission on the account, since validations below `validNonceFrom` stop
 *   running. Callers should warn before revoking an unused grant.
 */
export async function revokePermissionContext(
  kernelClient: KernelAccountClient,
  permissionsContext: string,
): Promise<{
  method: 'uninstall' | 'invalidate-nonce'
  userOpHash: Hex
  transactionHash: Hex
}> {
  const account = kernelClient.account
  if (!account) throw new Error('revokePermissions: no smart account')
  const {
    account: grantedOn,
    permissionId,
    policyCount,
  } = decodePermissionContext(permissionsContext)
  if (!isAddressEqual(grantedOn, account.address)) {
    throw new Error(
      'revokePermissions: this permission belongs to another account',
    )
  }

  const vId = concatHex([
    PERMISSION_VALIDATION_TYPE,
    pad(permissionId, { size: 20, dir: 'right' }),
  ])
  const client = account.client
  const installed = await readContract(client, {
    address: account.address,
    abi: kernelAbi,
    functionName: 'validationConfig',
    args: [vId],
  }).then(
    (config) => config.hook !== zeroAddress,
    // An undelegated or undeployed account has no installed permissions.
    () => false,
  )

  let data: Hex
  if (installed) {
    data = encodeFunctionData({
      abi: kernelAbi,
      functionName: 'uninstallValidation',
      args: [
        vId,
        encodeAbiParameters(
          [{ type: 'bytes[]' }],
          [Array.from({ length: policyCount + 1 }, () => '0x' as Hex)],
        ),
        '0x',
      ],
    })
  } else {
    const nonce = await readContract(client, {
      address: account.address,
      abi: kernelAbi,
      functionName: 'currentNonce',
    }).catch(() => 0)
    data = encodeFunctionData({
      abi: kernelAbi,
      functionName: 'invalidateNonce',
      args: [nonce + 1],
    })
  }

  const userOpHash = await kernelClient.sendUserOperation({
    calls: [{ to: account.address, data, value: 0n }],
  })
  const { receipt } = await kernelClient.waitForUserOperationReceipt({
    hash: userOpHash,
  })
  return {
    method: installed ? 'uninstall' : 'invalidate-nonce',
    userOpHash,
    transactionHash: receipt.transactionHash,
  }
}
