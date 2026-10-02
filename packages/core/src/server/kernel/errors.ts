import { BaseError, type Hex, toFunctionSelector } from 'viem'

/**
 * Why a session-key call was refused on-chain. `call-arguments` and
 * `call-value` come from the call policy; `call-target` means no permission
 * covers the call at all; `usage-limit` means the grant's `maxUses` is spent.
 */
export type PermissionDeniedReason =
  | 'call-arguments'
  | 'call-value'
  | 'call-target'
  | 'usage-limit'

const CALL_POLICY_ERRORS: Record<Hex, PermissionDeniedReason> = {
  [toFunctionSelector('CallViolatesParamRule()')]: 'call-arguments',
  [toFunctionSelector('CallViolatesValueRule()')]: 'call-value',
  [toFunctionSelector('InvalidCallType()')]: 'call-target',
  [toFunctionSelector('InvalidCallData()')]: 'call-target',
  // ponytail: Kernel's PolicyFailed(i) is generic; the rate-limit policy is the
  // only one our grants include that fails instead of reverting with its own error.
  [toFunctionSelector('PolicyFailed(uint256)')]: 'usage-limit',
}

/** The call is outside what the user granted. Retrying will not help. */
export class PermissionDeniedError extends Error {
  override name = 'PermissionDeniedError'
  constructor(
    readonly reason: PermissionDeniedReason,
    override readonly cause: unknown,
  ) {
    super(
      {
        'call-arguments':
          'The call arguments break a rule of the granted permission.',
        'call-value': 'The call sends more value than the permission allows.',
        'call-target': 'No granted permission covers this call.',
        'usage-limit':
          'The permission has been used as many times as the user allowed.',
      }[reason],
    )
  }
}

/** The permission is outside its validity window. Ask the user to grant again. */
export class PermissionExpiredError extends Error {
  override name = 'PermissionExpiredError'
  constructor(override readonly cause: unknown) {
    super('The granted permission has expired or is not active yet.')
  }
}

function errorText(error: unknown): string {
  if (error instanceof BaseError) {
    return [error.shortMessage, error.details, error.message].join(' ')
  }
  return error instanceof Error ? error.message : String(error)
}

/**
 * Maps a bundler/EntryPoint failure from a session-key user operation to a
 * typed permission error. Returns the original error when it is something else
 * (network, paymaster, gas), so callers can rethrow it unchanged.
 *
 * - AA22 "expired or not due": the timestamp policy's window does not cover now.
 * - AA23 "reverted 0x<selector>": a policy reverted during validation.
 */
export function parsePermissionError(error: unknown): unknown {
  const text = errorText(error)
  if (/AA22/.test(text)) return new PermissionExpiredError(error)
  const revert = text.match(/AA23 reverted (0x[0-9a-fA-F]{8})/)
  const reason = revert && CALL_POLICY_ERRORS[revert[1]!.toLowerCase() as Hex]
  if (reason) return new PermissionDeniedError(reason, error)
  return error
}
