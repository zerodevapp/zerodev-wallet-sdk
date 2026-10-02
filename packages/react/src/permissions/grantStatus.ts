import {
  type Address,
  type Client,
  concatHex,
  type Hex,
  pad,
  parseAbi,
  zeroAddress,
} from 'viem'
import { readContract } from 'viem/actions'
import type { Erc7715GrantPermissionsRequest } from './erc7715.js'

/** A grant the wallet made, kept so it can be listed later. Holds no key. */
export type GrantRecord = {
  permissionsContext: string
  account: Address
  chainId: number
  expiry: number
  permissionId: Hex
  /** The account's Kernel nonce the enable signature was made at. */
  enableNonce: number
  request: Erc7715GrantPermissionsRequest
  grantedAt: number
}

/**
 * - `active`: installed on the account, the session key can use it.
 * - `pending`: granted, not used yet, still usable.
 * - `revoked`: uninstalled, or disabled by a nonce invalidation.
 * - `void`: never used, and can no longer be: the account's nonce moved,
 *   normally through a nonce invalidation.
 * - `expired`: past its expiry.
 */
export type GrantStatus = 'active' | 'pending' | 'revoked' | 'void' | 'expired'

export type GrantChainState = {
  /** `validationConfig(vId)`: the nonce it was installed at, and its hook (zero when not installed). */
  installedNonce: number
  hook: Address
  currentNonce: number
  validNonceFrom: number
}

/**
 * Kernel's rules, applied to one grant:
 * - an enable signature installs only while `currentNonce` equals its nonce;
 *   `currentNonce` moves on `invalidateNonce` (or when a permission id is
 *   re-installed at the current nonce), not on a fresh install, so several
 *   unused grants can coexist
 * - a non-root validation runs only while its nonce >= `validNonceFrom`
 * - uninstall clears the hook but keeps the nonce, so the grant cannot be
 *   replayed
 */
export function classifyGrant(
  record: Pick<GrantRecord, 'expiry' | 'enableNonce'>,
  chain: GrantChainState,
  nowSeconds: number,
): GrantStatus {
  if (record.expiry <= nowSeconds) return 'expired'
  const installed = chain.hook !== zeroAddress
  if (installed) {
    return chain.installedNonce >= chain.validNonceFrom ? 'active' : 'revoked'
  }
  if (
    chain.installedNonce !== 0 &&
    chain.installedNonce === record.enableNonce
  ) {
    return 'revoked'
  }
  return chain.currentNonce === record.enableNonce &&
    record.enableNonce >= chain.validNonceFrom
    ? 'pending'
    : 'void'
}

const kernelAbi = parseAbi([
  'function validationConfig(bytes21 vId) view returns ((uint32 nonce, address hook))',
  'function currentNonce() view returns (uint32)',
  'function validNonceFrom() view returns (uint32)',
])

export function permissionValidationId(permissionId: Hex): Hex {
  return concatHex(['0x02', pad(permissionId, { size: 20, dir: 'right' })])
}

/** Kernel's current nonce, 0 for an account with no Kernel code yet. */
export async function readCurrentNonce(
  client: Client,
  account: Address,
): Promise<number> {
  return readContract(client, {
    address: account,
    abi: kernelAbi,
    functionName: 'currentNonce',
  }).catch(() => 0)
}

/** Reads the chain state `classifyGrant` needs. An account with no Kernel code reads as all zeros. */
export async function readGrantChainState(
  client: Client,
  record: Pick<GrantRecord, 'account' | 'permissionId'>,
): Promise<GrantChainState> {
  const read = <T>(p: Promise<T>, fallback: T) => p.catch(() => fallback)
  const [config, currentNonce, validNonceFrom] = await Promise.all([
    read(
      readContract(client, {
        address: record.account,
        abi: kernelAbi,
        functionName: 'validationConfig',
        args: [permissionValidationId(record.permissionId)],
      }),
      { nonce: 0, hook: zeroAddress },
    ),
    readCurrentNonce(client, record.account),
    read(
      readContract(client, {
        address: record.account,
        abi: kernelAbi,
        functionName: 'validNonceFrom',
      }),
      0,
    ),
  ])
  return {
    installedNonce: config.nonce,
    hook: config.hook,
    currentNonce,
    validNonceFrom,
  }
}
