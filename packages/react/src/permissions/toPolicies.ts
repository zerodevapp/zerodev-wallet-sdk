import type { Policy } from '@zerodev/permissions'
import {
  CallPolicyVersion,
  ParamCondition,
  toCallPolicy,
  toSudoPolicy,
  toTimestampPolicy,
} from '@zerodev/permissions/policies'
import type { ArgRule, GrantPermissionsParameters } from './types.js'

const CONDITIONS: Record<ArgRule['condition'], ParamCondition> = {
  equal: ParamCondition.EQUAL,
  notEqual: ParamCondition.NOT_EQUAL,
  greaterThan: ParamCondition.GREATER_THAN,
  lessThan: ParamCondition.LESS_THAN,
  greaterThanOrEqual: ParamCondition.GREATER_THAN_OR_EQUAL,
  lessThanOrEqual: ParamCondition.LESS_THAN_OR_EQUAL,
  oneOf: ParamCondition.ONE_OF,
}

/**
 * Turns a grant request into Kernel permission-plugin policies: one call
 * policy for all contract calls (or a sudo policy), plus a timestamp policy
 * for the expiry. Every grant expires; there is no way to request one that
 * does not.
 */
export function toPolicies(params: GrantPermissionsParameters): Policy[] {
  const { permissions, expiry } = params
  if (permissions.length === 0) {
    throw new Error('grantPermissions: request at least one permission')
  }
  if (expiry <= Math.floor(Date.now() / 1000)) {
    throw new Error('grantPermissions: expiry must be in the future')
  }
  const timestamp = toTimestampPolicy({ validUntil: expiry })

  if (permissions.some((p) => p.type === 'sudo')) {
    if (permissions.length > 1) {
      throw new Error(
        'grantPermissions: a sudo permission already allows everything; do not combine it with others',
      )
    }
    return [toSudoPolicy({}), timestamp]
  }

  const calls = permissions.flatMap((p) =>
    p.type === 'contract-call'
      ? [
          {
            target: p.target,
            abi: p.abi,
            functionName: p.functionName,
            valueLimit: p.valueLimit ?? 0n,
            ...(p.args && {
              args: p.args.map((rule) =>
                rule
                  ? { condition: CONDITIONS[rule.condition], value: rule.value }
                  : null,
              ),
            }),
          },
        ]
      : [],
  )
  return [
    toCallPolicy({
      policyVersion: CallPolicyVersion.V0_0_5,
      // The call policy infers its permission type from literal ABIs; ours are runtime values.
      permissions: calls as NonNullable<
        Parameters<typeof toCallPolicy>[0]['permissions']
      >,
    }),
    timestamp,
  ]
}
